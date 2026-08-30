import { createPrismaClient, db } from "@aurbit/db";
import { structuredLog } from "./logger";

const INVITE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const INVITE_CLEANUP_BATCH_SIZE = 500;

export async function cleanupOldInvites(
  now = new Date(),
  database: Pick<typeof db, "organizationInvite"> = db,
): Promise<number> {
  const cutoff = new Date(now.getTime() - INVITE_RETENTION_MS);
  const where = {
    expiresAt: { lt: cutoff },
    lastSentAt: { lt: cutoff },
    AND: [
      { OR: [{ acceptedAt: null }, { acceptedAt: { lt: cutoff } }] },
      { OR: [{ revokedAt: null }, { revokedAt: { lt: cutoff } }] },
    ],
  };
  const candidates = await database.organizationInvite.findMany({
    where,
    select: { id: true },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: INVITE_CLEANUP_BATCH_SIZE,
  });
  if (candidates.length === 0) return 0;

  // Re-check eligibility: a resend/revocation can happen after selection.
  const result = await database.organizationInvite.deleteMany({
    where: { ...where, id: { in: candidates.map(({ id }) => id) } },
  });
  return result.count;
}

export async function runScheduledMaintenance(now = new Date()): Promise<void> {
  const startedAt = Date.now();
  const job = "cleanup_old_workspace_invites";
  try {
    // Workers sockets belong to their invocation, not a global client pool.
    // Own this client so closing it cannot interrupt concurrent Queue work.
    const database = createPrismaClient();
    let deletedCount: number;
    try {
      deletedCount = await cleanupOldInvites(now, database);
    } finally {
      await database.$disconnect();
    }
    structuredLog("info", "scheduled_maintenance_completed", {
      job,
      deletedCount,
      batchLimitReached: deletedCount === INVITE_CLEANUP_BATCH_SIZE,
      durationMs: Date.now() - startedAt,
      success: true,
    });
  } catch (error) {
    // Database error messages can contain SQL/record data; do not log them.
    structuredLog("error", "scheduled_maintenance_failed", {
      job,
      durationMs: Date.now() - startedAt,
      success: false,
    });
    throw error;
  }
}
