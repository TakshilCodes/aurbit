import { db } from "@aurbit/db";
import { z } from "zod";
import { requireOrganizationMembership } from "./authorization";
import { AUDIT_ACTIONS, writeAuditLog } from "./audit-log";

export const REPORT_TRIAGE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export const REPORT_TRIAGE_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const INTERNAL_NOTE_MAX_LENGTH = 4_000;

const resourceIdSchema = z.string().trim().min(1).max(100);

export const reportTriageInputSchema = z.discriminatedUnion("field", [
  z
    .object({
      field: z.literal("status"),
      value: z.enum(REPORT_TRIAGE_STATUSES),
    })
    .strict(),
  z
    .object({
      field: z.literal("priority"),
      value: z.enum(REPORT_TRIAGE_PRIORITIES),
    })
    .strict(),
  z
    .object({
      field: z.literal("assignee"),
      value: resourceIdSchema.nullable(),
    })
    .strict(),
]);

export const internalNoteInputSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, "Write a note before adding it.")
      .max(
        INTERNAL_NOTE_MAX_LENGTH,
        "Notes must be 4,000 characters or fewer.",
      ),
  })
  .strict();

export type ReportTriageInput = z.infer<typeof reportTriageInputSchema>;

export class InternalNoteDeletionError extends Error {
  constructor() {
    super("You can delete only your own internal notes.");
    this.name = "InternalNoteDeletionError";
  }
}

export class InvalidReportAssigneeError extends Error {
  constructor() {
    super("The selected assignee is not available in this workspace.");
    this.name = "InvalidReportAssigneeError";
  }
}

const reportTriageSelect = {
  id: true,
  status: true,
  priority: true,
  updatedAt: true,
  assigneeMemberId: true,
  assignee: {
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
} as const;

export async function updateReportTriage(
  organizationId: string,
  reportId: string,
  input: unknown,
) {
  const parsed = reportTriageInputSchema.parse(input);
  const { user } = await requireOrganizationMembership(organizationId);

  return db.$transaction(async (transaction) => {
    const current = await transaction.bugReport.findFirst({
      where: { id: reportId, organizationId },
      select: reportTriageSelect,
    });

    if (!current) return null;

    if (parsed.field === "assignee" && parsed.value) {
      const assignee = await transaction.organizationMember.findFirst({
        where: { id: parsed.value, organizationId },
        select: { id: true },
      });

      if (!assignee) throw new InvalidReportAssigneeError();
    }

    const previousValue =
      parsed.field === "status"
        ? current.status
        : parsed.field === "priority"
          ? current.priority
          : current.assigneeMemberId;

    if (previousValue === parsed.value) return current;

    const data =
      parsed.field === "status"
        ? { status: parsed.value }
        : parsed.field === "priority"
          ? { priority: parsed.value }
          : { assigneeMemberId: parsed.value };
    const report = await transaction.bugReport.update({
      where: { id: current.id },
      data,
      select: reportTriageSelect,
    });
    const action =
      parsed.field === "status"
        ? AUDIT_ACTIONS.REPORT_STATUS_CHANGED
        : parsed.field === "priority"
          ? AUDIT_ACTIONS.REPORT_PRIORITY_CHANGED
          : AUDIT_ACTIONS.REPORT_ASSIGNEE_CHANGED;
    await writeAuditLog(transaction, {
      action,
      actorUserId: user.id,
      organizationId,
      targetId: report.id,
      targetType: "bug_report",
      metadata: { from: previousValue, to: parsed.value },
    });
    return report;
  });
}

export async function createInternalNote(
  organizationId: string,
  reportId: string,
  input: unknown,
) {
  const parsed = internalNoteInputSchema.parse(input);
  const { user } = await requireOrganizationMembership(organizationId);

  return db.$transaction(async (transaction) => {
    const report = await transaction.bugReport.findFirst({
      where: { id: reportId, organizationId },
      select: { id: true },
    });

    if (!report) return null;

    const note = await transaction.internalNote.create({
      data: {
        organizationId,
        bugReportId: report.id,
        authorId: user.id,
        body: parsed.body,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true, image: true } },
      },
    });
    await writeAuditLog(transaction, {
      action: AUDIT_ACTIONS.INTERNAL_NOTE_CREATED,
      actorUserId: user.id,
      organizationId,
      targetId: note.id,
      targetType: "internal_note",
      metadata: { reportId: report.id },
    });
    return note;
  });
}

export async function deleteInternalNote(
  organizationId: string,
  reportId: string,
  noteId: unknown,
) {
  const parsedNoteId = resourceIdSchema.parse(noteId);
  const { membership, user } =
    await requireOrganizationMembership(organizationId);

  return db.$transaction(async (transaction) => {
    const note = await transaction.internalNote.findFirst({
      where: {
        id: parsedNoteId,
        organizationId,
        bugReportId: reportId,
      },
      select: { id: true, authorId: true },
    });

    if (!note) return null;

    if (membership.role === "MEMBER" && note.authorId !== user.id) {
      throw new InternalNoteDeletionError();
    }

    const deleted = await transaction.internalNote.deleteMany({
      where: {
        id: note.id,
        organizationId,
        bugReportId: reportId,
      },
    });
    if (deleted.count !== 1) return null;

    await writeAuditLog(transaction, {
      action: AUDIT_ACTIONS.INTERNAL_NOTE_DELETED,
      actorUserId: user.id,
      organizationId,
      targetId: note.id,
      targetType: "internal_note",
      metadata: { reportId },
    });

    return { id: note.id };
  });
}
