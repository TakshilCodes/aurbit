import { EmailDeliveryStatus, type OrganizationRole } from "@aurbit/db";
import type { ReportCreatedEvent } from "@aurbit/async-events";
import { describe, expect, it, vi } from "vitest";
import type {
  EmailDeliveryRecord,
  EmailDeliveryStore,
} from "./email-delivery-store";
import { EmailProviderError, type EmailSender } from "./email";
import {
  PermanentEventProcessingError,
  RetryableEventProcessingError,
} from "./event-errors";
import {
  handleReportCreatedNotification,
  loadReportCreatedNotificationContext,
  REPORT_CREATED_NOTIFICATION_TYPE,
  selectWorkspaceAdminRecipients,
  type ReportCreatedNotificationContext,
} from "./report-created-notification";

const event: ReportCreatedEvent = {
  eventId: "77d8bc7b-f20c-42c3-905a-a6f3211502d7",
  occurredAt: "2026-08-30T10:30:00.000Z",
  reportId: "report_1",
  type: "report.created",
  version: 1,
};

const context: ReportCreatedNotificationContext = {
  createdAt: new Date("2026-08-30T10:30:00.000Z"),
  organizationId: "organization_1",
  projectName: "Customer dashboard",
  recipients: ["owner@example.com", "admin@example.com"],
  reporterEmail: "reporter@example.com",
  reportId: "report_1",
  reportTitle: "Checkout button is unresponsive",
  workspaceName: "Acme",
};

function membership(
  organizationId: string,
  role: OrganizationRole,
  email: string,
) {
  return { organizationId, role, user: { email } };
}

function createDeliveryHarness() {
  const deliveries = new Map<string, EmailDeliveryRecord>();
  let nextId = 1;
  const deliveryKey = (input: {
    eventId: string;
    notificationType: string;
    recipient: string;
  }) => `${input.eventId}:${input.notificationType}:${input.recipient}`;
  const getOrCreate = vi.fn<EmailDeliveryStore["getOrCreate"]>((input) => {
    const existing = deliveries.get(deliveryKey(input));
    if (existing) return Promise.resolve(existing);
    const delivery = {
      id: `delivery_${nextId++}`,
      status: EmailDeliveryStatus.PENDING,
    };
    deliveries.set(deliveryKey(input), delivery);
    return Promise.resolve(delivery);
  });
  const markPermanentFailure = vi.fn<
    EmailDeliveryStore["markPermanentFailure"]
  >((id) => {
    for (const delivery of deliveries.values()) {
      if (delivery.id === id) {
        delivery.status = EmailDeliveryStatus.PERMANENT_FAILURE;
      }
    }
    return Promise.resolve();
  });
  const markRetryableFailure = vi.fn<
    EmailDeliveryStore["markRetryableFailure"]
  >((id) => {
    for (const delivery of deliveries.values()) {
      if (delivery.id === id) {
        delivery.status = EmailDeliveryStatus.RETRYABLE_FAILURE;
      }
    }
    return Promise.resolve();
  });
  const markSent = vi.fn<EmailDeliveryStore["markSent"]>((id) => {
    for (const delivery of deliveries.values()) {
      if (delivery.id === id) delivery.status = EmailDeliveryStatus.SENT;
    }
    return Promise.resolve();
  });

  return {
    getOrCreate,
    markPermanentFailure,
    markRetryableFailure,
    markSent,
    store: {
      getOrCreate,
      markPermanentFailure,
      markRetryableFailure,
      markSent,
    } satisfies EmailDeliveryStore,
  };
}

function createSender(
  implementation: EmailSender["send"] = () =>
    Promise.resolve({ providerMessageId: "resend_1" }),
) {
  const send = vi.fn<EmailSender["send"]>(implementation);
  return { send, sender: { send } satisfies EmailSender };
}

function dependencies(
  emailSender: EmailSender,
  deliveryStore: EmailDeliveryStore,
  notificationContext: ReportCreatedNotificationContext | null = context,
) {
  return {
    adminAppUrl: "https://admin.aurbit.test",
    deliveryStore,
    emailSender,
    loadContext: vi.fn(() => Promise.resolve(notificationContext)),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("report-created notifications", () => {
  it("selects only tenant-correct OWNER and ADMIN emails and deduplicates them", () => {
    expect(
      selectWorkspaceAdminRecipients("organization_1", [
        membership("organization_1", "OWNER", "Owner@Example.com"),
        membership("organization_1", "ADMIN", "owner@example.com"),
        membership("organization_1", "ADMIN", "admin@example.com"),
        membership("organization_1", "MEMBER", "member@example.com"),
        membership("organization_2", "OWNER", "other@example.com"),
        membership("organization_1", "ADMIN", "not-an-email"),
      ]),
    ).toEqual(["owner@example.com", "admin@example.com"]);
  });

  it("loads recipients through the report project and workspace relationship", async () => {
    const findUnique = vi.fn((input: unknown) => {
      void input;
      return Promise.resolve({
        createdAt: context.createdAt,
        id: context.reportId,
        reporterEmail: context.reporterEmail,
        title: context.reportTitle,
        project: {
          name: context.projectName,
          organization: {
            id: context.organizationId,
            memberships: [
              membership("organization_1", "OWNER", "owner@example.com"),
              membership("organization_2", "OWNER", "other@example.com"),
            ],
            name: context.workspaceName,
          },
        },
      });
    });

    await expect(
      loadReportCreatedNotificationContext("report_1", { findUnique }),
    ).resolves.toMatchObject({
      organizationId: "organization_1",
      recipients: ["owner@example.com"],
      reportId: "report_1",
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "report_1" } }),
    );
  });

  it("renders safe notification inputs and records every successful send", async () => {
    const sender = createSender();
    const delivery = createDeliveryHarness();

    await handleReportCreatedNotification(
      event,
      dependencies(sender.sender, delivery.store),
    );

    expect(sender.send).toHaveBeenCalledTimes(2);
    const ownerInput = sender.send.mock.calls.find(
      ([input]) => input.to === "owner@example.com",
    )?.[0];
    expect(ownerInput).toMatchObject({
      to: "owner@example.com",
    });
    expect(ownerInput?.html).toContain("Checkout button is unresponsive");
    expect(ownerInput?.subject).toContain("Customer dashboard");
    expect(ownerInput?.text).toContain("reporter@example.com");
    expect(delivery.markSent).toHaveBeenCalledTimes(2);
    const firstInput = sender.send.mock.calls[0]?.[0];
    expect(firstInput?.html).not.toContain("internal note");
  });

  it("does not resend a notification whose durable delivery is already sent", async () => {
    const sender = createSender();
    const getOrCreate = vi.fn<EmailDeliveryStore["getOrCreate"]>(() =>
      Promise.resolve({
        id: "delivery_1",
        status: EmailDeliveryStatus.SENT,
      }),
    );
    const markPermanentFailure = vi.fn<
      EmailDeliveryStore["markPermanentFailure"]
    >(() => Promise.resolve());
    const markRetryableFailure = vi.fn<
      EmailDeliveryStore["markRetryableFailure"]
    >(() => Promise.resolve());
    const markSent = vi.fn<EmailDeliveryStore["markSent"]>(() =>
      Promise.resolve(),
    );
    const store = {
      getOrCreate,
      markPermanentFailure,
      markRetryableFailure,
      markSent,
    } satisfies EmailDeliveryStore;

    await handleReportCreatedNotification(
      event,
      dependencies(sender.sender, store, {
        ...context,
        recipients: ["owner@example.com"],
      }),
    );

    expect(sender.send).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });

  it("keeps transient provider failures retryable", async () => {
    const sender = createSender(() =>
      Promise.reject(new EmailProviderError("application_error", true)),
    );
    const delivery = createDeliveryHarness();

    await expect(
      handleReportCreatedNotification(
        event,
        dependencies(sender.sender, delivery.store, {
          ...context,
          recipients: ["owner@example.com"],
        }),
      ),
    ).rejects.toBeInstanceOf(RetryableEventProcessingError);
    expect(delivery.markRetryableFailure).toHaveBeenCalledWith(
      "delivery_1",
      "application_error",
    );
  });

  it("records a permanent recipient failure without retrying the event", async () => {
    const sender = createSender(() =>
      Promise.reject(new EmailProviderError("validation_error", false)),
    );
    const delivery = createDeliveryHarness();

    await expect(
      handleReportCreatedNotification(
        event,
        dependencies(sender.sender, delivery.store, {
          ...context,
          recipients: ["invalid@example.com"],
        }),
      ),
    ).resolves.toBeUndefined();
    expect(delivery.markPermanentFailure).toHaveBeenCalledWith(
      "delivery_1",
      "validation_error",
    );
  });

  it("does not repeat successful recipients when another recipient is retried", async () => {
    const delivery = createDeliveryHarness();
    const send = vi
      .fn<EmailSender["send"]>()
      .mockResolvedValueOnce({ providerMessageId: "resend_owner" })
      .mockRejectedValueOnce(
        new EmailProviderError("rate_limit_exceeded", true),
      )
      .mockResolvedValueOnce({ providerMessageId: "resend_admin" });
    const sender = { send } satisfies EmailSender;
    const handlerDependencies = dependencies(sender, delivery.store);

    await expect(
      handleReportCreatedNotification(event, handlerDependencies),
    ).rejects.toBeInstanceOf(RetryableEventProcessingError);
    await expect(
      handleReportCreatedNotification(event, handlerDependencies),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(3);
    expect(
      send.mock.calls.filter(([input]) => input.to === "owner@example.com"),
    ).toHaveLength(1);
  });

  it("treats a missing report as a permanent event failure", async () => {
    const sender = createSender();
    const delivery = createDeliveryHarness();

    await expect(
      handleReportCreatedNotification(
        event,
        dependencies(sender.sender, delivery.store, null),
      ),
    ).rejects.toBeInstanceOf(PermanentEventProcessingError);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("uses the event, notification, and durable delivery ID for provider idempotency", async () => {
    const sender = createSender();
    const delivery = createDeliveryHarness();

    await handleReportCreatedNotification(
      event,
      dependencies(sender.sender, delivery.store, {
        ...context,
        recipients: ["owner@example.com"],
      }),
    );

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `aurbit/${REPORT_CREATED_NOTIFICATION_TYPE}/delivery_1`,
      }),
    );
  });
});
