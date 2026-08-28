import type { Prisma } from "@aurbit/db";

export const AUDIT_ACTIONS = {
  INTERNAL_NOTE_CREATED: "report.internal_note_created",
  MEMBER_ADDED: "workspace.member_added",
  MEMBER_REMOVED: "workspace.member_removed",
  MEMBER_ROLE_CHANGED: "workspace.member_role_changed",
  REPORT_ASSIGNEE_CHANGED: "report.assignee_changed",
  REPORT_PRIORITY_CHANGED: "report.priority_changed",
  REPORT_STATUS_CHANGED: "report.status_changed",
} as const;

type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export function writeAuditLog(
  client: AuditClient,
  input: {
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
    actorUserId?: string | null;
    metadata?: Prisma.InputJsonObject;
    organizationId: string;
    targetId?: string | null;
    targetType: "bug_report" | "internal_note" | "organization_member";
  },
) {
  return client.auditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      metadata: input.metadata,
      organizationId: input.organizationId,
      targetId: input.targetId ?? null,
      targetType: input.targetType,
    },
    select: { id: true },
  });
}
