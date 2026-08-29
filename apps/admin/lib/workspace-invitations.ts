import {
  checkRateLimit,
  getRateLimitStore,
  type RateLimitStore,
} from "@aurbit/rate-limit";
import { db, type OrganizationRole, Prisma } from "@aurbit/db";
import { z } from "zod";
import {
  AuthorizationError,
  requireOrganizationMembership,
  requireUser,
} from "./authorization";
import { AUDIT_ACTIONS, writeAuditLog } from "./audit-log";
import { sendWorkspaceInvitationEmail } from "./email";
import { generateSecureToken, hashToken } from "./tokens";

const INVITABLE_ROLES = ["ADMIN", "MEMBER"] as const;
const resourceIdSchema = z.string().trim().min(1).max(100);
const inviteTokenSchema = z
  .string()
  .trim()
  .length(64)
  .regex(/^[a-f0-9]+$/);

export const WORKSPACE_INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const WORKSPACE_INVITE_RESEND_LIMIT = {
  attempts: 3,
  windowSeconds: 15 * 60,
} as const;

export const createWorkspaceInviteSchema = z
  .object({
    email: z.string().trim().email().max(254).transform(normalizeInviteEmail),
    role: z.enum(INVITABLE_ROLES),
  })
  .strict();

export const workspaceInviteIdSchema = z
  .object({ inviteId: resourceIdSchema })
  .strict();

export type WorkspaceInviteStatus =
  | "accepted"
  | "expired"
  | "invalid"
  | "revoked"
  | "valid";

export class WorkspaceInviteError extends Error {
  constructor(
    public readonly code:
      | "ALREADY_MEMBER"
      | "ALREADY_PENDING"
      | "EMAIL_MISMATCH"
      | "EMAIL_UNVERIFIED"
      | "INSUFFICIENT_ROLE"
      | "INVITE_ACCEPTED"
      | "INVITE_EXPIRED"
      | "INVITE_NOT_FOUND"
      | "INVITE_REVOKED"
      | "RATE_LIMITED"
      | "RATE_LIMIT_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceInviteError";
  }
}

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function listPendingWorkspaceInvitesForUser(email: string) {
  return db.organizationInvite.findMany({
    where: {
      email: normalizeInviteEmail(email),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      invitedBy: { select: { email: true, name: true } },
      organization: { select: { name: true } },
    },
  });
}

function pendingInviteKey(organizationId: string, email: string) {
  return `${organizationId}:${email}`;
}

function assertCanInvite(
  actorRole: OrganizationRole,
  inviteRole: OrganizationRole,
) {
  if (
    inviteRole === "OWNER" ||
    actorRole === "MEMBER" ||
    (actorRole === "ADMIN" && inviteRole !== "MEMBER")
  ) {
    throw new WorkspaceInviteError(
      "INSUFFICIENT_ROLE",
      actorRole === "ADMIN"
        ? "Workspace admins can invite people only as Members."
        : "Only workspace owners and admins can invite people.",
    );
  }
}

async function freshActor(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
) {
  const actor = await transaction.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!actor) throw new AuthorizationError();
  return actor;
}

function assertUsableInvite(invite: {
  acceptedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}) {
  if (invite.acceptedAt) {
    throw new WorkspaceInviteError(
      "INVITE_ACCEPTED",
      "This invitation has already been accepted.",
    );
  }
  if (invite.revokedAt) {
    throw new WorkspaceInviteError(
      "INVITE_REVOKED",
      "This invitation has been revoked.",
    );
  }
  if (invite.expiresAt <= new Date()) {
    throw new WorkspaceInviteError(
      "INVITE_EXPIRED",
      "This invitation has expired.",
    );
  }
}

function invitationDeliveryInput(invite: {
  email: string;
  expiresAt: Date;
  invitedBy: { email: string; name: string | null };
  organization: { name: string };
  role: OrganizationRole;
}) {
  if (invite.role === "OWNER") {
    throw new WorkspaceInviteError(
      "INSUFFICIENT_ROLE",
      "Owner invitations are not supported.",
    );
  }
  return {
    email: invite.email,
    expiresAt: invite.expiresAt,
    inviterName: invite.invitedBy.name?.trim() || invite.invitedBy.email,
    role: invite.role,
    workspaceName: invite.organization.name,
  } as const;
}

export async function createWorkspaceInvite(
  organizationId: string,
  input: unknown,
) {
  const parsed = createWorkspaceInviteSchema.parse(input);
  const { user } = await requireOrganizationMembership(organizationId);
  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const now = new Date();

  let invite;
  try {
    invite = await db.$transaction(async (transaction) => {
      const actor = await freshActor(transaction, organizationId, user.id);
      assertCanInvite(actor.role, parsed.role);

      const existingUser = await transaction.user.findUnique({
        where: { email: parsed.email },
        select: {
          memberships: {
            where: { organizationId },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (existingUser?.memberships.length) {
        throw new WorkspaceInviteError(
          "ALREADY_MEMBER",
          "This person is already a workspace member.",
        );
      }

      const pendingKey = pendingInviteKey(organizationId, parsed.email);
      const pending = await transaction.organizationInvite.findUnique({
        where: { pendingKey },
        select: { id: true, expiresAt: true },
      });
      if (pending?.expiresAt && pending.expiresAt > now) {
        throw new WorkspaceInviteError(
          "ALREADY_PENDING",
          "An active invitation already exists for this email.",
        );
      }
      if (pending) {
        await transaction.organizationInvite.update({
          where: { id: pending.id },
          data: { pendingKey: null, revokedAt: now },
          select: { id: true },
        });
      }

      const created = await transaction.organizationInvite.create({
        data: {
          email: parsed.email,
          expiresAt: new Date(now.getTime() + WORKSPACE_INVITE_LIFETIME_MS),
          invitedByUserId: user.id,
          organizationId,
          pendingKey,
          role: parsed.role,
          tokenHash,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          expiresAt: true,
          lastSentAt: true,
          invitedBy: { select: { email: true, name: true } },
          organization: { select: { name: true } },
        },
      });
      await writeAuditLog(transaction, {
        action: AUDIT_ACTIONS.WORKSPACE_INVITE_CREATED,
        actorUserId: user.id,
        organizationId,
        targetId: created.id,
        targetType: "workspace_invite",
        metadata: { email: parsed.email, role: parsed.role },
      });
      return created;
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new WorkspaceInviteError(
        "ALREADY_PENDING",
        "An active invitation already exists for this email.",
      );
    }
    throw error;
  }

  try {
    await sendWorkspaceInvitationEmail({
      ...invitationDeliveryInput(invite),
      token: rawToken,
    });
    return { delivery: "sent" as const, invite };
  } catch {
    return { delivery: "failed" as const, invite };
  }
}

export async function checkWorkspaceInviteResendRateLimit(
  organizationId: string,
  inviteId: string,
  store: RateLimitStore = getRateLimitStore(),
) {
  return checkRateLimit(
    {
      key: `aurbit:workspace-invite:resend:${organizationId}:${inviteId}`,
      limit: WORKSPACE_INVITE_RESEND_LIMIT.attempts,
      windowSeconds: WORKSPACE_INVITE_RESEND_LIMIT.windowSeconds,
    },
    store,
  );
}

export async function resendWorkspaceInvite(
  organizationId: string,
  input: unknown,
) {
  const { inviteId } = workspaceInviteIdSchema.parse(input);
  const { membership, user } =
    await requireOrganizationMembership(organizationId);
  const scopedInvite = await db.organizationInvite.findFirst({
    where: { id: inviteId, organizationId },
    select: { role: true },
  });
  if (!scopedInvite) {
    throw new WorkspaceInviteError("INVITE_NOT_FOUND", "Invitation not found.");
  }
  assertCanInvite(membership.role, scopedInvite.role);

  let withinLimit: boolean;
  try {
    withinLimit = await checkWorkspaceInviteResendRateLimit(
      organizationId,
      inviteId,
    );
  } catch {
    throw new WorkspaceInviteError(
      "RATE_LIMIT_UNAVAILABLE",
      "Invitation resend is unavailable right now. Try again.",
    );
  }
  if (!withinLimit) {
    throw new WorkspaceInviteError(
      "RATE_LIMITED",
      "Too many resend attempts. Wait a few minutes and try again.",
    );
  }

  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const now = new Date();
  const invite = await db.$transaction(async (transaction) => {
    const actor = await freshActor(transaction, organizationId, user.id);
    const current = await transaction.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
      select: {
        id: true,
        email: true,
        role: true,
        acceptedAt: true,
        revokedAt: true,
      },
    });
    if (!current) {
      throw new WorkspaceInviteError(
        "INVITE_NOT_FOUND",
        "Invitation not found.",
      );
    }
    assertCanInvite(actor.role, current.role);
    if (current.acceptedAt) {
      throw new WorkspaceInviteError(
        "INVITE_ACCEPTED",
        "This invitation has already been accepted.",
      );
    }
    if (current.revokedAt) {
      throw new WorkspaceInviteError(
        "INVITE_REVOKED",
        "This invitation has been revoked.",
      );
    }

    const updated = await transaction.organizationInvite.update({
      where: { id: current.id },
      data: {
        expiresAt: new Date(now.getTime() + WORKSPACE_INVITE_LIFETIME_MS),
        lastSentAt: now,
        tokenHash,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        lastSentAt: true,
        invitedBy: { select: { email: true, name: true } },
        organization: { select: { name: true } },
      },
    });
    await writeAuditLog(transaction, {
      action: AUDIT_ACTIONS.WORKSPACE_INVITE_RESENT,
      actorUserId: user.id,
      organizationId,
      targetId: updated.id,
      targetType: "workspace_invite",
      metadata: { email: updated.email, role: updated.role },
    });
    return updated;
  }, TRANSACTION_OPTIONS);

  try {
    await sendWorkspaceInvitationEmail({
      ...invitationDeliveryInput(invite),
      token: rawToken,
    });
    return { delivery: "sent" as const, invite };
  } catch {
    return { delivery: "failed" as const, invite };
  }
}

export async function revokeWorkspaceInvite(
  organizationId: string,
  input: unknown,
) {
  const { inviteId } = workspaceInviteIdSchema.parse(input);
  const { user } = await requireOrganizationMembership(organizationId);

  return db.$transaction(async (transaction) => {
    const actor = await freshActor(transaction, organizationId, user.id);
    const invite = await transaction.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
      select: {
        id: true,
        email: true,
        role: true,
        acceptedAt: true,
        revokedAt: true,
      },
    });
    if (!invite) {
      throw new WorkspaceInviteError(
        "INVITE_NOT_FOUND",
        "Invitation not found.",
      );
    }
    assertCanInvite(actor.role, invite.role);
    if (invite.acceptedAt) {
      throw new WorkspaceInviteError(
        "INVITE_ACCEPTED",
        "This invitation has already been accepted.",
      );
    }
    if (invite.revokedAt) {
      throw new WorkspaceInviteError(
        "INVITE_REVOKED",
        "This invitation has already been revoked.",
      );
    }

    const revoked = await transaction.organizationInvite.update({
      where: { id: invite.id },
      data: { pendingKey: null, revokedAt: new Date() },
      select: { id: true },
    });
    await writeAuditLog(transaction, {
      action: AUDIT_ACTIONS.WORKSPACE_INVITE_REVOKED,
      actorUserId: user.id,
      organizationId,
      targetId: invite.id,
      targetType: "workspace_invite",
      metadata: { email: invite.email, role: invite.role },
    });
    return revoked;
  }, TRANSACTION_OPTIONS);
}

export async function getWorkspaceInvitePreview(rawToken: unknown): Promise<
  | {
      status: Exclude<WorkspaceInviteStatus, "invalid">;
      invite: {
        email: string;
        role: "ADMIN" | "MEMBER";
        expiresAt: Date;
        invitedBy: { email: string; name: string | null };
        organization: { name: string };
      };
    }
  | { status: "invalid" }
> {
  const parsed = inviteTokenSchema.safeParse(rawToken);
  if (!parsed.success) return { status: "invalid" };
  const tokenHash = await hashToken(parsed.data);
  const invite = await db.organizationInvite.findUnique({
    where: { tokenHash },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      invitedBy: { select: { email: true, name: true } },
      organization: { select: { name: true } },
    },
  });
  if (!invite || invite.role === "OWNER") return { status: "invalid" };
  const status = invite.acceptedAt
    ? "accepted"
    : invite.revokedAt
      ? "revoked"
      : invite.expiresAt <= new Date()
        ? "expired"
        : "valid";
  return { status, invite: { ...invite, role: invite.role } };
}

async function acceptWorkspaceInviteWhere(
  where: { id: string } | { tokenHash: string },
) {
  const user = await requireUser();
  if (!user.emailVerified) {
    throw new WorkspaceInviteError(
      "EMAIL_UNVERIFIED",
      "Verify your Aurbit email before accepting this invitation.",
    );
  }
  return db.$transaction(async (transaction) => {
    const invite = await transaction.organizationInvite.findUnique({
      where,
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        acceptedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    if (!invite || invite.role === "OWNER") {
      throw new WorkspaceInviteError(
        "INVITE_NOT_FOUND",
        "This invitation link is invalid.",
      );
    }
    assertUsableInvite(invite);
    if (normalizeInviteEmail(user.email) !== invite.email) {
      throw new WorkspaceInviteError(
        "EMAIL_MISMATCH",
        `Sign in with ${invite.email} to accept this invitation.`,
      );
    }

    const existing = await transaction.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: user.id,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new WorkspaceInviteError(
        "ALREADY_MEMBER",
        "You are already a member of this workspace.",
      );
    }

    const consumed = await transaction.organizationInvite.updateMany({
      where: {
        id: invite.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { acceptedAt: new Date(), pendingKey: null },
    });
    if (consumed.count !== 1) {
      throw new WorkspaceInviteError(
        "INVITE_ACCEPTED",
        "This invitation is no longer available.",
      );
    }

    const member = await transaction.organizationMember.create({
      data: {
        organizationId: invite.organizationId,
        role: invite.role,
        userId: user.id,
      },
      select: { id: true },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { activeOrganizationId: invite.organizationId },
      select: { id: true },
    });
    await writeAuditLog(transaction, {
      action: AUDIT_ACTIONS.WORKSPACE_INVITE_ACCEPTED,
      actorUserId: user.id,
      organizationId: invite.organizationId,
      targetId: invite.id,
      targetType: "workspace_invite",
      metadata: { memberId: member.id, role: invite.role },
    });
    return { organizationId: invite.organizationId };
  }, TRANSACTION_OPTIONS);
}

export async function acceptWorkspaceInvite(rawToken: unknown) {
  const parsed = inviteTokenSchema.safeParse(rawToken);
  if (!parsed.success) {
    throw new WorkspaceInviteError(
      "INVITE_NOT_FOUND",
      "This invitation link is invalid.",
    );
  }
  const tokenHash = await hashToken(parsed.data);
  return acceptWorkspaceInviteWhere({ tokenHash });
}

export function acceptWorkspaceInviteFromDashboard(inviteId: unknown) {
  const parsedInviteId = resourceIdSchema.safeParse(inviteId);
  if (!parsedInviteId.success) {
    throw new WorkspaceInviteError(
      "INVITE_NOT_FOUND",
      "This invitation is not available.",
    );
  }
  return acceptWorkspaceInviteWhere({ id: parsedInviteId.data });
}
