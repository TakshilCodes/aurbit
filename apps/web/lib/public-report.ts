import { BugReportPriority, BugReportStatus, db } from "@aurbit/db";
import { z } from "zod";
import { enqueueEvent } from "./async-events";
import { resolvePublicProjectTarget } from "./public-project";
import {
  createPublicReportAttachmentObjectKey,
  getPublicReportAttachmentStore,
  preparePublicReportAttachments,
  PublicReportAttachmentValidationError,
  type PublicReportAttachmentStore,
} from "./public-report-attachments";
import {
  protectPublicReportRequest,
  type PublicReportProtectionFailure,
  type PublicReportProtectionInput,
} from "./public-report-protection";
import {
  type PublicReportFieldErrors,
  type PublicReportSubmissionState,
} from "./public-report-state";

export const PUBLIC_REPORT_VALIDATION_LIMITS = {
  description: 10_000,
  pageUrl: 2_048,
  projectKey: 32,
  reporterEmail: 254,
  title: 160,
  userAgent: 512,
  viewportDimension: 10_000,
} as const;

type PublicReportRequestContext = Pick<
  PublicReportProtectionInput,
  "ip" | "turnstileToken"
> & {
  attachments: readonly FormDataEntryValue[];
};

type PublicReportDependencies = {
  attachmentStore?: PublicReportAttachmentStore;
  createId?: () => string;
  enqueue?: typeof enqueueEvent;
  protect?: typeof protectPublicReportRequest;
};

const optionalText = <Schema extends z.ZodType<string>>(schema: Schema) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }, schema.optional());

const optionalViewportDimension = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? Number(value) : value;
}, z.number().int().min(1).max(PUBLIC_REPORT_VALIDATION_LIMITS.viewportDimension).optional());

const publicReportSchema = z
  .object({
    projectKey: z
      .string()
      .max(PUBLIC_REPORT_VALIDATION_LIMITS.projectKey)
      .regex(/^pk_proj_[a-f0-9]{24}$/),
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters.")
      .max(
        PUBLIC_REPORT_VALIDATION_LIMITS.title,
        "Title must be 160 characters or fewer.",
      ),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters.")
      .max(
        PUBLIC_REPORT_VALIDATION_LIMITS.description,
        "Description must be 10,000 characters or fewer.",
      ),
    reporterEmail: optionalText(
      z
        .string()
        .max(
          PUBLIC_REPORT_VALIDATION_LIMITS.reporterEmail,
          "Email must be 254 characters or fewer.",
        )
        .email("Enter a valid email address.")
        .transform((value) => value.toLowerCase()),
    ),
    pageUrl: optionalText(
      z
        .string()
        .max(PUBLIC_REPORT_VALIDATION_LIMITS.pageUrl, "Page URL is too long.")
        .url("Page URL must be valid.")
        .refine(
          (value) => {
            const protocol = new URL(value).protocol;
            return protocol === "http:" || protocol === "https:";
          },
          { message: "Page URL must use HTTP or HTTPS." },
        )
        .transform((value) => {
          const url = new URL(value);
          url.username = "";
          url.password = "";
          url.search = "";
          url.hash = "";
          return url.toString();
        }),
    ),
    userAgent: optionalText(
      z
        .string()
        .max(
          PUBLIC_REPORT_VALIDATION_LIMITS.userAgent,
          "Browser metadata is too long.",
        ),
    ),
    viewportWidth: optionalViewportDimension,
    viewportHeight: optionalViewportDimension,
  })
  .strict();

function protectionError(
  reason: PublicReportProtectionFailure,
): PublicReportSubmissionState {
  if (reason === "rate-limited") {
    return {
      message: "Too many reports were sent. Please wait and try again.",
      status: "error",
    };
  }

  if (reason === "turnstile-invalid") {
    return {
      message: "Security verification failed or expired. Try again.",
      status: "error",
    };
  }

  return {
    message: "Unable to verify this report right now. Try again.",
    status: "error",
  };
}

export async function createPublicBugReport(
  input: unknown,
  requestContext: PublicReportRequestContext,
  dependencies: PublicReportDependencies = {},
): Promise<PublicReportSubmissionState> {
  const parsed = publicReportSchema.safeParse(input);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as PublicReportFieldErrors,
      message: "Check the highlighted fields and try again.",
      status: "error",
    };
  }

  const protection = await (dependencies.protect ?? protectPublicReportRequest)(
    {
      ip: requestContext.ip,
      projectKey: parsed.data.projectKey,
      turnstileToken: requestContext.turnstileToken,
    },
  );

  if (!protection.allowed) {
    return protectionError(protection.reason);
  }

  let attachments;

  try {
    attachments = await preparePublicReportAttachments(
      requestContext.attachments,
    );
  } catch (error) {
    return {
      fieldErrors:
        error instanceof PublicReportAttachmentValidationError
          ? { attachments: [error.message] }
          : undefined,
      message:
        error instanceof PublicReportAttachmentValidationError
          ? "Check the selected attachments and try again."
          : "Couldn't process the selected attachments. Try again.",
      status: "error",
    };
  }

  const project = await resolvePublicProjectTarget(parsed.data.projectKey);

  if (!project) {
    return {
      message: "This report link is invalid or no longer available.",
      status: "error",
    };
  }

  const uploadedKeys: string[] = [];
  let attachmentStore: PublicReportAttachmentStore | undefined;
  let reportId: string;

  try {
    const attachmentMetadata: Array<{
      contentType: string;
      fileName: string;
      size: number;
      storageKey: string;
    }> = [];

    if (attachments.length > 0) {
      attachmentStore =
        dependencies.attachmentStore ?? getPublicReportAttachmentStore();
      const createId = dependencies.createId ?? (() => crypto.randomUUID());
      const submissionId = createId();

      for (const attachment of attachments) {
        const storageKey = createPublicReportAttachmentObjectKey(
          submissionId,
          attachment.extension,
          createId(),
        );
        uploadedKeys.push(storageKey);
        await attachmentStore.put(
          storageKey,
          attachment.body,
          attachment.contentType,
        );
        attachmentMetadata.push({
          contentType: attachment.contentType,
          fileName: attachment.fileName,
          size: attachment.size,
          storageKey,
        });
      }
    }

    const report = await db.bugReport.create({
      data: {
        attachments:
          attachmentMetadata.length > 0
            ? { create: attachmentMetadata }
            : undefined,
        description: parsed.data.description,
        organizationId: project.organizationId,
        pageUrl: parsed.data.pageUrl ?? null,
        priority: BugReportPriority.MEDIUM,
        projectId: project.projectId,
        reporterEmail: parsed.data.reporterEmail ?? null,
        status: BugReportStatus.OPEN,
        title: parsed.data.title,
        userAgent: parsed.data.userAgent ?? null,
        viewportHeight: parsed.data.viewportHeight ?? null,
        viewportWidth: parsed.data.viewportWidth ?? null,
      },
      select: { id: true },
    });
    reportId = report.id;
  } catch {
    if (attachmentStore && uploadedKeys.length > 0) {
      try {
        await attachmentStore.delete(uploadedKeys);
      } catch {
        // The report was not created; cleanup can be retried operationally.
      }
    }

    return {
      message: "Couldn't send your report. Try again.",
      status: "error",
    };
  }

  try {
    await (dependencies.enqueue ?? enqueueEvent)({
      reportId,
      type: "report.created",
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        errorName: error instanceof Error ? error.name : "UnknownError",
        eventType: "report.created",
        level: "error",
        message: "async_event_enqueue_failed",
        reportId,
      }),
    );
  }

  return {
    message: "Your report was sent to the team.",
    status: "success",
  };
}
