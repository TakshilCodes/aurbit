import {
  db,
  EmailDeliveryStatus,
  OrganizationRole,
  type Prisma,
} from "@aurbit/db";
import type { ReportCreatedEvent } from "@aurbit/async-events";
import { z } from "zod";
import type { EmailDeliveryStore } from "./email-delivery-store";
import { EmailProviderError, type EmailSender } from "./email";
import {
  PermanentEventProcessingError,
  RetryableEventProcessingError,
} from "./event-errors";
import { logger } from "./logger";
import type { Logger } from "@aurbit/logger";
import { captureUnexpectedError } from "./observability";
import { createReportCreatedEmail } from "./report-created-email";

export const REPORT_CREATED_NOTIFICATION_TYPE =
  "report.created.workspace-admins";

type MembershipRecord = {
  organizationId: string;
  role: OrganizationRole;
  user: { email: string };
};

const reportCreatedNotificationSelect = {
  id: true,
  title: true,
  reporterEmail: true,
  createdAt: true,
  project: {
    select: {
      name: true,
      organization: {
        select: {
          id: true,
          name: true,
          memberships: {
            where: {
              role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
            },
            select: {
              organizationId: true,
              role: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.BugReportSelect;

type ReportRecord = Prisma.BugReportGetPayload<{
  select: typeof reportCreatedNotificationSelect;
}>;

type ReportLookup = {
  findUnique(input: {
    select: typeof reportCreatedNotificationSelect;
    where: { id: string };
  }): Promise<ReportRecord | null>;
};

export type ReportCreatedNotificationContext = {
  createdAt: Date;
  organizationId: string;
  projectName: string;
  recipients: string[];
  reporterEmail: string | null;
  reportId: string;
  reportTitle: string;
  workspaceName: string;
};

type NotificationDependencies = {
  adminAppUrl: string;
  deliveryStore: EmailDeliveryStore;
  emailSender: EmailSender;
  loadContext?: (
    reportId: string,
  ) => Promise<ReportCreatedNotificationContext | null>;
  log?: Pick<Logger, "info" | "warn" | "error">;
};

const recipientSchema = z.string().trim().max(254).email();

export function selectWorkspaceAdminRecipients(
  organizationId: string,
  memberships: readonly MembershipRecord[],
) {
  const recipients = new Set<string>();

  for (const membership of memberships) {
    if (membership.organizationId !== organizationId) continue;
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") continue;

    const parsed = recipientSchema.safeParse(membership.user.email);
    if (!parsed.success) continue;
    recipients.add(parsed.data.toLowerCase());
  }

  return [...recipients];
}

export async function loadReportCreatedNotificationContext(
  reportId: string,
  reportLookup?: ReportLookup,
): Promise<ReportCreatedNotificationContext | null> {
  const input = {
    where: { id: reportId },
    select: reportCreatedNotificationSelect,
  };
  const report = reportLookup
    ? await reportLookup.findUnique(input)
    : await db.bugReport.findUnique(input);

  if (!report) return null;

  const organization = report.project.organization;
  return {
    createdAt: report.createdAt,
    organizationId: organization.id,
    projectName: report.project.name,
    recipients: selectWorkspaceAdminRecipients(
      organization.id,
      organization.memberships,
    ),
    reporterEmail: report.reporterEmail,
    reportId: report.id,
    reportTitle: report.title,
    workspaceName: organization.name,
  };
}

function reportUrl(
  adminAppUrl: string,
  context: ReportCreatedNotificationContext,
) {
  return new URL(
    `/organizations/${encodeURIComponent(context.organizationId)}/reports/${encodeURIComponent(context.reportId)}`,
    adminAppUrl,
  ).toString();
}

function logoUrl(adminAppUrl: string) {
  return new URL("/brand/aurbit-wordmark.png", adminAppUrl).toString();
}

function createdAtLabel(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export async function handleReportCreatedNotification(
  event: ReportCreatedEvent,
  dependencies: NotificationDependencies,
) {
  const log = dependencies.log ?? logger;
  const context = await (
    dependencies.loadContext ?? loadReportCreatedNotificationContext
  )(event.reportId);

  if (!context) {
    throw new PermanentEventProcessingError("report_not_found");
  }

  const content = createReportCreatedEmail({
    createdAt: createdAtLabel(context.createdAt),
    logoUrl: logoUrl(dependencies.adminAppUrl),
    projectName: context.projectName,
    reporterEmail: context.reporterEmail,
    reportTitle: context.reportTitle,
    reportUrl: reportUrl(dependencies.adminAppUrl, context),
    workspaceName: context.workspaceName,
  });
  let retryableFailureCount = 0;
  let sentCount = 0;
  let skippedCount = 0;

  for (const recipient of context.recipients) {
    const delivery = await dependencies.deliveryStore.getOrCreate({
      eventId: event.eventId,
      notificationType: REPORT_CREATED_NOTIFICATION_TYPE,
      recipient,
    });

    if (
      delivery.status === EmailDeliveryStatus.SENT ||
      delivery.status === EmailDeliveryStatus.PERMANENT_FAILURE
    ) {
      skippedCount += 1;
      continue;
    }

    try {
      const result = await dependencies.emailSender.send({
        ...content,
        idempotencyKey: `aurbit/${REPORT_CREATED_NOTIFICATION_TYPE}/${delivery.id}`,
        to: recipient,
      });
      await dependencies.deliveryStore.markSent(
        delivery.id,
        result.providerMessageId,
      );
      sentCount += 1;
      log.info("notification_email_sent", {
        deliveryId: delivery.id,
        eventId: event.eventId,
        eventType: event.type,
        notificationType: REPORT_CREATED_NOTIFICATION_TYPE,
        providerMessageId: result.providerMessageId,
        reportId: event.reportId,
      });
    } catch (error) {
      if (!(error instanceof EmailProviderError)) {
        captureUnexpectedError(error, {
          eventId: event.eventId,
          reportId: event.reportId,
          deliveryId: delivery.id,
        });
      }
      const providerError =
        error instanceof EmailProviderError
          ? error
          : new EmailProviderError("delivery_state_update_failed", true);

      if (providerError.retryable) {
        retryableFailureCount += 1;
        try {
          await dependencies.deliveryStore.markRetryableFailure(
            delivery.id,
            providerError.code,
          );
        } catch {
          // The queue retry remains the source of recovery when persistence fails.
        }
        log.error("notification_email_retryable_failure", {
          deliveryId: delivery.id,
          errorCode: providerError.code,
          eventId: event.eventId,
          eventType: event.type,
          notificationType: REPORT_CREATED_NOTIFICATION_TYPE,
          reportId: event.reportId,
        });
        continue;
      }

      await dependencies.deliveryStore.markPermanentFailure(
        delivery.id,
        providerError.code,
      );
      skippedCount += 1;
      log.warn("notification_email_permanent_failure", {
        deliveryId: delivery.id,
        errorCode: providerError.code,
        eventId: event.eventId,
        eventType: event.type,
        notificationType: REPORT_CREATED_NOTIFICATION_TYPE,
        reportId: event.reportId,
      });
    }
  }

  log.info("report_created_notification_processed", {
    eventId: event.eventId,
    eventType: event.type,
    notificationType: REPORT_CREATED_NOTIFICATION_TYPE,
    recipientCount: context.recipients.length,
    reportId: event.reportId,
    retryableFailureCount,
    sentCount,
    skippedCount,
  });

  if (retryableFailureCount > 0) {
    throw new RetryableEventProcessingError("email_delivery_incomplete");
  }
}
