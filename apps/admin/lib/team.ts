import { db, type OrganizationRole, Prisma } from "@aurbit/db";
import { z } from "zod";
import {
  AuthorizationError,
  requireOrganizationMembership,
} from "./authorization";
import { AUDIT_ACTIONS, writeAuditLog } from "./audit-log";

const TEAM_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
const resourceIdSchema = z.string().trim().min(1).max(100);

export const updateWorkspaceMemberRoleSchema = z
  .object({ memberId: resourceIdSchema, role: z.enum(TEAM_ROLES) })
  .strict();

export const removeWorkspaceMemberSchema = z
  .object({ memberId: resourceIdSchema })
  .strict();

export class TeamManagementError extends Error {
  constructor(
    public readonly code:
      | "INSUFFICIENT_ROLE"
      | "LAST_OWNER"
      | "MEMBER_NOT_FOUND"
      | "SELF_MANAGEMENT",
    message: string,
  ) {
    super(message);
    this.name = "TeamManagementError";
  }
}

type Transaction = Prisma.TransactionClient;

const TEAM_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

async function freshActor(
  transaction: Transaction,
  organizationId: string,
  userId: string,
) {
  const actor = await transaction.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { id: true, role: true, userId: true },
  });

  if (!actor) throw new AuthorizationError();
  return actor;
}

function assertCanManageTeam(role: OrganizationRole) {
  if (role === "MEMBER") {
    throw new TeamManagementError(
      "INSUFFICIENT_ROLE",
      "Only workspace owners and admins can manage the team.",
    );
  }
}

function assertRoleChangeAllowed(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
  nextRole: OrganizationRole,
) {
  assertCanManageTeam(actorRole);

  if (
    actorRole === "ADMIN" &&
    (targetRole !== "MEMBER" || nextRole === "OWNER")
  ) {
    throw new TeamManagementError(
      "INSUFFICIENT_ROLE",
      "Admins can manage members but cannot manage owners or other admins.",
    );
  }
}

async function assertOwnerRemains(
  transaction: Transaction,
  organizationId: string,
  targetRole: OrganizationRole,
) {
  if (targetRole !== "OWNER") return;

  const ownerCount = await transaction.organizationMember.count({
    where: { organizationId, role: "OWNER" },
  });

  if (ownerCount <= 1) {
    throw new TeamManagementError(
      "LAST_OWNER",
      "The last workspace owner cannot be removed or demoted.",
    );
  }
}

export async function listWorkspaceTeam(organizationId: string) {
  const { membership, organization, user } =
    await requireOrganizationMembership(organizationId);
  const [members, invites] = await Promise.all([
    db.organizationMember.findMany({
      where: { organizationId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        createdAt: true,
        userId: true,
        user: { select: { email: true, image: true, name: true } },
      },
    }),
    db.organizationInvite.findMany({
      where: { organizationId, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        lastSentAt: true,
        invitedBy: { select: { email: true, name: true } },
      },
    }),
  ]);

  return { actorUserId: user.id, invites, membership, members, organization };
}

export async function updateWorkspaceMemberRole(
  organizationId: string,
  input: unknown,
) {
  const parsed = updateWorkspaceMemberRoleSchema.parse(input);
  const { user } = await requireOrganizationMembership(organizationId);

  return db.$transaction(async (transaction) => {
    const actor = await freshActor(transaction, organizationId, user.id);
    const target = await transaction.organizationMember.findFirst({
      where: { id: parsed.memberId, organizationId },
      select: { id: true, role: true, userId: true },
    });

    if (!target) {
      throw new TeamManagementError("MEMBER_NOT_FOUND", "Member not found.");
    }

    if (target.userId === user.id) {
      throw new TeamManagementError(
        "SELF_MANAGEMENT",
        "Ask another workspace owner to change your role.",
      );
    }

    assertRoleChangeAllowed(actor.role, target.role, parsed.role);
    if (target.role === parsed.role) return target;
    if (target.role === "OWNER" && parsed.role !== "OWNER") {
      await assertOwnerRemains(transaction, organizationId, target.role);
    }

    const member = await transaction.organizationMember.update({
      where: { id: target.id },
      data: { role: parsed.role },
      select: { id: true, role: true, userId: true },
    });
    await writeAuditLog(transaction, {
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      actorUserId: user.id,
      organizationId,
      targetId: member.id,
      targetType: "organization_member",
      metadata: { fromRole: target.role, toRole: member.role },
    });
    return member;
  }, TEAM_TRANSACTION_OPTIONS);
}

export async function removeWorkspaceMember(
  organizationId: string,
  input: unknown,
) {
  const parsed = removeWorkspaceMemberSchema.parse(input);
  const { user } = await requireOrganizationMembership(organizationId);

  return db.$transaction(async (transaction) => {
    const actor = await freshActor(transaction, organizationId, user.id);
    const target = await transaction.organizationMember.findFirst({
      where: { id: parsed.memberId, organizationId },
      select: { id: true, role: true, userId: true },
    });

    if (!target) {
      throw new TeamManagementError("MEMBER_NOT_FOUND", "Member not found.");
    }

    if (target.userId === user.id) {
      throw new TeamManagementError(
        "SELF_MANAGEMENT",
        "You cannot remove your own workspace membership.",
      );
    }

    assertRoleChangeAllowed(actor.role, target.role, target.role);
    await assertOwnerRemains(transaction, organizationId, target.role);
    await transaction.organizationMember.delete({ where: { id: target.id } });
    await writeAuditLog(transaction, {
      action: AUDIT_ACTIONS.MEMBER_REMOVED,
      actorUserId: user.id,
      organizationId,
      targetId: target.id,
      targetType: "organization_member",
      metadata: { role: target.role },
    });
    return { id: target.id };
  }, TEAM_TRANSACTION_OPTIONS);
}
