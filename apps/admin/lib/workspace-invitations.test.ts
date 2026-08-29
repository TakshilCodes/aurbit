import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptUpdateMany: vi.fn(),
  checkRateLimit: vi.fn(),
  createAudit: vi.fn(),
  createInvite: vi.fn(),
  createMember: vi.fn(),
  findActor: vi.fn(),
  findInvite: vi.fn(),
  findInvitePreview: vi.fn(),
  findMembership: vi.fn(),
  findPendingInvite: vi.fn(),
  findPendingInvitesForUser: vi.fn(),
  findScopedInvite: vi.fn(),
  findUser: vi.fn(),
  generateToken: vi.fn(),
  hashToken: vi.fn(),
  requireMembership: vi.fn(),
  requireUser: vi.fn(),
  sendInvite: vi.fn(),
  transaction: vi.fn(),
  updateInvite: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@aurbit/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRateLimitStore: vi.fn(() => ({})),
}));

vi.mock("@aurbit/db", () => ({
  db: {
    $transaction: mocks.transaction,
    organizationInvite: {
      findFirst: mocks.findScopedInvite,
      findMany: mocks.findPendingInvitesForUser,
      findUnique: mocks.findInvitePreview,
    },
  },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));

vi.mock("./authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireOrganizationMembership: mocks.requireMembership,
  requireUser: mocks.requireUser,
}));

vi.mock("./email", () => ({
  sendWorkspaceInvitationEmail: mocks.sendInvite,
}));

vi.mock("./tokens", () => ({
  generateSecureToken: mocks.generateToken,
  hashToken: mocks.hashToken,
}));

import {
  acceptWorkspaceInvite,
  acceptWorkspaceInviteFromDashboard,
  createWorkspaceInvite,
  listPendingWorkspaceInvitesForUser,
  resendWorkspaceInvite,
  revokeWorkspaceInvite,
} from "./workspace-invitations";

const organizationId = "organization_1";
const rawToken = "a".repeat(64);
const future = new Date("2026-09-05T12:00:00.000Z");

function inviteFixture(role: "ADMIN" | "MEMBER" = "MEMBER") {
  return {
    id: "invite_1",
    email: "invitee@example.com",
    role,
    createdAt: new Date("2026-08-29T12:00:00.000Z"),
    expiresAt: future,
    lastSentAt: new Date("2026-08-29T12:00:00.000Z"),
    acceptedAt: null,
    revokedAt: null,
    invitedBy: { email: "owner@example.com", name: "Owner Name" },
    organization: { name: "Acme" },
    organizationId,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-29T12:00:00.000Z"));
  mocks.generateToken.mockReturnValue(rawToken);
  mocks.hashToken.mockResolvedValue("hashed-token");
  mocks.requireMembership.mockResolvedValue({
    membership: { role: "OWNER" },
    user: { id: "actor_1" },
  });
  mocks.requireUser.mockResolvedValue({
    id: "invitee_1",
    email: "invitee@example.com",
    emailVerified: new Date(),
  });
  mocks.findActor.mockResolvedValue({ role: "OWNER" });
  mocks.findUser.mockResolvedValue({ memberships: [] });
  mocks.findPendingInvite.mockResolvedValue(null);
  mocks.findPendingInvitesForUser.mockResolvedValue([]);
  mocks.createInvite.mockImplementation(
    ({ data }: { data: { role: string } }) =>
      Promise.resolve(inviteFixture(data.role as "ADMIN" | "MEMBER")),
  );
  mocks.createAudit.mockResolvedValue({ id: "audit_1" });
  mocks.sendInvite.mockResolvedValue(undefined);
  mocks.findMembership.mockResolvedValue(null);
  mocks.acceptUpdateMany.mockResolvedValue({ count: 1 });
  mocks.createMember.mockResolvedValue({ id: "member_1" });
  mocks.updateUser.mockResolvedValue({ id: "invitee_1" });
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.updateInvite.mockImplementation(() => Promise.resolve(inviteFixture()));
  mocks.transaction.mockImplementation(
    (operation: (client: unknown) => unknown) =>
      operation({
        auditLog: { create: mocks.createAudit },
        organizationInvite: {
          create: mocks.createInvite,
          findFirst: mocks.findInvite,
          findUnique: (input: { where: { pendingKey?: string } }): unknown =>
            (input.where.pendingKey
              ? mocks.findPendingInvite(input)
              : mocks.findInvite(input)) as unknown,
          update: mocks.updateInvite,
          updateMany: mocks.acceptUpdateMany,
        },
        organizationMember: {
          create: mocks.createMember,
          findFirst: mocks.findActor,
          findUnique: mocks.findMembership,
        },
        user: { findUnique: mocks.findUser, update: mocks.updateUser },
      }),
  );
});

describe("workspace invitations", () => {
  it.each(["ADMIN", "MEMBER"] as const)(
    "allows an OWNER to invite a %s",
    async (role) => {
      await expect(
        createWorkspaceInvite(organizationId, {
          email: "Invitee@Example.com",
          role,
        }),
      ).resolves.toMatchObject({ delivery: "sent" });
      expect(mocks.createInvite).toHaveBeenCalledOnce();
    },
  );

  it("allows an ADMIN to invite a MEMBER", async () => {
    mocks.findActor.mockResolvedValue({ role: "ADMIN" });
    await expect(
      createWorkspaceInvite(organizationId, {
        email: "invitee@example.com",
        role: "MEMBER",
      }),
    ).resolves.toMatchObject({ delivery: "sent" });
  });

  it.each([
    ["MEMBER", "MEMBER"],
    ["ADMIN", "ADMIN"],
  ] as const)("rejects %s inviting %s", async (actorRole, role) => {
    mocks.findActor.mockResolvedValue({ role: actorRole });
    await expect(
      createWorkspaceInvite(organizationId, {
        email: "invitee@example.com",
        role,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ROLE" });
    expect(mocks.createInvite).not.toHaveBeenCalled();
  });

  it("rejects OWNER invitations at validation", async () => {
    await expect(
      createWorkspaceInvite(organizationId, {
        email: "invitee@example.com",
        role: "OWNER",
      }),
    ).rejects.toBeDefined();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not invite an existing workspace member", async () => {
    mocks.findUser.mockResolvedValue({ memberships: [{ id: "member_1" }] });
    await expect(
      createWorkspaceInvite(organizationId, {
        email: "invitee@example.com",
        role: "MEMBER",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
  });

  it("rejects a duplicate active invitation", async () => {
    mocks.findPendingInvite.mockResolvedValue({
      id: "invite_1",
      expiresAt: future,
    });
    await expect(
      createWorkspaceInvite(organizationId, {
        email: "invitee@example.com",
        role: "MEMBER",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_PENDING" });
  });

  it("stores only the token hash and sends safe template inputs", async () => {
    await createWorkspaceInvite(organizationId, {
      email: "Invitee@Example.com",
      role: "MEMBER",
    });
    const createInput = mocks.createInvite.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createInput.data).toMatchObject({
      email: "invitee@example.com",
      tokenHash: "hashed-token",
    });
    expect(JSON.stringify(createInput.data)).not.toContain(rawToken);
    expect(mocks.sendInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "invitee@example.com",
        inviterName: "Owner Name",
        token: rawToken,
        workspaceName: "Acme",
      }),
    );
    const auditInput = mocks.createAudit.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(JSON.stringify(auditInput.data)).not.toContain(rawToken);
    expect(auditInput.data).toMatchObject({
      action: "workspace_invite_created",
    });
  });

  it("lists only active invitations for the normalized account email", async () => {
    mocks.findPendingInvitesForUser.mockResolvedValue([inviteFixture()]);

    await expect(
      listPendingWorkspaceInvitesForUser(" Invitee@Example.com "),
    ).resolves.toHaveLength(1);

    const listInput = mocks.findPendingInvitesForUser.mock.calls[0]?.[0] as {
      where: {
        acceptedAt: null;
        email: string;
        expiresAt: { gt: unknown };
        revokedAt: null;
      };
    };
    expect(listInput.where).toMatchObject({
      email: "invitee@example.com",
      acceptedAt: null,
      revokedAt: null,
    });
    expect(listInput.where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("accepts a dashboard invitation using its stored workspace and role", async () => {
    mocks.findInvite.mockResolvedValue(inviteFixture("ADMIN"));

    await expect(
      acceptWorkspaceInviteFromDashboard("invite_1"),
    ).resolves.toEqual({ organizationId });

    const findInput = mocks.findInvite.mock.calls[0]?.[0] as {
      where: { id: string };
    };
    expect(findInput.where).toEqual({ id: "invite_1" });
    const createInput = mocks.createMember.mock.calls[0]?.[0] as {
      data: { organizationId: string; role: string };
    };
    expect(createInput.data).toMatchObject({
      organizationId,
      role: "ADMIN",
    });
  });

  it("accepts a valid invite and creates exactly one membership", async () => {
    mocks.findInvite.mockResolvedValue(inviteFixture());
    await expect(acceptWorkspaceInvite(rawToken)).resolves.toEqual({
      organizationId,
    });
    expect(mocks.createMember).toHaveBeenCalledOnce();
    const consumeInput = mocks.acceptUpdateMany.mock.calls[0]?.[0] as {
      data: { acceptedAt: unknown; pendingKey: unknown };
    };
    expect(consumeInput.data.acceptedAt).toBeInstanceOf(Date);
    expect(consumeInput.data.pendingKey).toBeNull();
    const auditInput = mocks.createAudit.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "workspace_invite_accepted",
      organizationId,
    });
  });

  it.each([
    [
      "expired",
      { expiresAt: new Date("2026-08-28T12:00:00.000Z") },
      "INVITE_EXPIRED",
    ],
    ["revoked", { revokedAt: new Date() }, "INVITE_REVOKED"],
    ["reused", { acceptedAt: new Date() }, "INVITE_ACCEPTED"],
  ] as const)("rejects an %s invite", async (_label, override, code) => {
    mocks.findInvite.mockResolvedValue({ ...inviteFixture(), ...override });
    await expect(acceptWorkspaceInvite(rawToken)).rejects.toMatchObject({
      code,
    });
    expect(mocks.createMember).not.toHaveBeenCalled();
  });

  it("rejects the wrong authenticated email", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "wrong_user",
      email: "wrong@example.com",
      emailVerified: new Date(),
    });
    mocks.findInvite.mockResolvedValue(inviteFixture());
    await expect(acceptWorkspaceInvite(rawToken)).rejects.toMatchObject({
      code: "EMAIL_MISMATCH",
    });
    expect(mocks.createMember).not.toHaveBeenCalled();
  });

  it("fails safely for a cross-workspace invite ID", async () => {
    mocks.findScopedInvite.mockResolvedValue(null);
    await expect(
      resendWorkspaceInvite(organizationId, { inviteId: "other_invite" }),
    ).rejects.toMatchObject({ code: "INVITE_NOT_FOUND" });
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  it("rotates the token when an authorized resend succeeds", async () => {
    mocks.requireMembership.mockResolvedValue({
      membership: { role: "ADMIN" },
      user: { id: "actor_1" },
    });
    mocks.findScopedInvite.mockResolvedValue({ role: "MEMBER" });
    mocks.findActor.mockResolvedValue({ role: "ADMIN" });
    mocks.findInvite.mockResolvedValue(inviteFixture());
    await resendWorkspaceInvite(organizationId, { inviteId: "invite_1" });
    const updateInput = mocks.updateInvite.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateInput.data).toMatchObject({ tokenHash: "hashed-token" });
    const auditInput = mocks.createAudit.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "workspace_invite_resent",
    });
  });

  it("enforces role authorization on revoke", async () => {
    mocks.findActor.mockResolvedValue({ role: "ADMIN" });
    mocks.findInvite.mockResolvedValue(inviteFixture("ADMIN"));
    await expect(
      revokeWorkspaceInvite(organizationId, { inviteId: "invite_1" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ROLE" });
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });
  it("blocks resend when the shared limiter is exceeded", async () => {
    mocks.findScopedInvite.mockResolvedValue({ role: "MEMBER" });
    mocks.checkRateLimit.mockResolvedValue(false);
    await expect(
      resendWorkspaceInvite(organizationId, { inviteId: "invite_1" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("revokes a tenant-scoped invite and records an audit event", async () => {
    mocks.findInvite.mockResolvedValue(inviteFixture());
    mocks.updateInvite.mockResolvedValue({ id: "invite_1" });
    await expect(
      revokeWorkspaceInvite(organizationId, { inviteId: "invite_1" }),
    ).resolves.toEqual({ id: "invite_1" });
    const updateInput = mocks.updateInvite.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateInput.data).toMatchObject({ pendingKey: null });
    expect(updateInput.data.revokedAt).toBeInstanceOf(Date);
    const auditInput = mocks.createAudit.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "workspace_invite_revoked",
      organizationId,
      targetId: "invite_1",
    });
  });
});
