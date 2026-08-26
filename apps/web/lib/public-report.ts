import { BugReportPriority, BugReportStatus, db } from "@aurbit/db";
import { z } from "zod";
import { resolvePublicProjectTarget } from "./public-project";
import {
  type PublicReportFieldErrors,
  type PublicReportSubmissionState,
} from "./public-report-state";

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
}, z.number().int().min(1).max(10_000).optional());

const publicReportSchema = z
  .object({
    projectKey: z.string().regex(/^pk_proj_[a-f0-9]{24}$/),
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters.")
      .max(160, "Title must be 160 characters or fewer."),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters.")
      .max(10_000, "Description must be 10,000 characters or fewer."),
    reporterEmail: optionalText(
      z
        .string()
        .max(254, "Email must be 254 characters or fewer.")
        .email("Enter a valid email address.")
        .transform((value) => value.toLowerCase()),
    ),
    pageUrl: optionalText(
      z
        .string()
        .max(2048, "Page URL is too long.")
        .url("Page URL must be valid.")
        .refine(
          (value) => {
            const protocol = new URL(value).protocol;
            return protocol === "http:" || protocol === "https:";
          },
          { message: "Page URL must use HTTP or HTTPS." },
        ),
    ),
    userAgent: optionalText(
      z.string().max(512, "Browser metadata is too long."),
    ),
    viewportWidth: optionalViewportDimension,
    viewportHeight: optionalViewportDimension,
  })
  .strict();

export async function createPublicBugReport(
  input: unknown,
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

  const project = await resolvePublicProjectTarget(parsed.data.projectKey);

  if (!project) {
    return {
      message: "This report link is invalid or no longer available.",
      status: "error",
    };
  }

  try {
    await db.bugReport.create({
      data: {
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
  } catch {
    return {
      message: "Couldn't send your report. Try again.",
      status: "error",
    };
  }

  return {
    message: "Your report was sent to the team.",
    status: "success",
  };
}
