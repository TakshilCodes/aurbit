import { db } from "@aurbit/db";
import { requireOrganizationMembership } from "./authorization";

export const AUDIT_PAGE_SIZE = 30;

export function parseAuditPage(value: string | string[] | undefined) {
  return typeof value === "string" && /^\d{1,5}$/.test(value)
    ? Math.max(1, Number(value))
    : 1;
}

export async function listOrganizationAuditLogs(
  organizationId: string,
  requestedPage: number,
) {
  const { membership, organization } =
    await requireOrganizationMembership(organizationId);
  const totalCount = await db.auditLog.count({ where: { organizationId } });
  const totalPages = Math.max(1, Math.ceil(totalCount / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const entries = await db.auditLog.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: { id: true, email: true, image: true, name: true },
      },
    },
  });

  return {
    entries,
    membership,
    organization,
    pagination: { page, pageSize: AUDIT_PAGE_SIZE, totalCount, totalPages },
  };
}
