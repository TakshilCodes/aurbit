import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countOwners: vi.fn(),
  createAudit: vi.fn(),
  createMember: vi.fn(),
  deleteMember: vi.fn(),
  findMember: vi.fn(),
  findMembership: vi.fn(),
  findUser: vi.fn(),
  requireMembership: vi.fn(),
  transaction: vi.fn(),
  updateMember: vi.fn(),
}));

vi.mock("@aurbit/db", () => ({
  db: { $transaction: mocks.transaction },
  Prisma: {
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));

vi.mock("./authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireOrganizationMembership: mocks.requireMembership,
}));

import { removeWorkspaceMember, updateWorkspaceMemberRole } from "./team";

const organizationId = "organization_1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMembership.mockResolvedValue({ user: { id: "actor_user" } });
  mocks.findUser.mockResolvedValue({
    id: "new_user",
    emailVerified: new Date(),
  });
  mocks.findMembership.mockResolvedValue(null);
  mocks.countOwners.mockResolvedValue(2);
  mocks.createMember.mockResolvedValue({
    id: "member_new",
    role: "MEMBER",
    userId: "new_user",
    createdAt: new Date(),
    user: { email: "new@example.com", image: null, name: "New User" },
  });
  mocks.updateMember.mockImplementation(
    ({ data }: { data: { role: string } }) =>
      Promise.resolve({
        id: "target_member",
        role: data.role,
        userId: "target_user",
      }),
  );
  mocks.createAudit.mockResolvedValue({ id: "audit_1" });
  mocks.transaction.mockImplementation(
    (callback: (transaction: unknown) => unknown) =>
      callback({
        auditLog: { create: mocks.createAudit },
        organizationMember: {
          count: mocks.countOwners,
          create: mocks.createMember,
          delete: mocks.deleteMember,
          findFirst: mocks.findMember,
          findUnique: mocks.findMembership,
          update: mocks.updateMember,
        },
        user: { findUnique: mocks.findUser },
      }),
  );
});

describe("workspace team management", () => {
  it("does not allow a MEMBER to manage the team", async () => {
    mocks.findMember
      .mockResolvedValueOnce({
        id: "actor_member",
        role: "MEMBER",
        userId: "actor_user",
      })
      .mockResolvedValueOnce({
        id: "target_member",
        role: "MEMBER",
        userId: "target_user",
      });

    await expect(
      updateWorkspaceMemberRole(organizationId, {
        memberId: "target_member",
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ROLE" });
    expect(mocks.updateMember).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("allows an ADMIN to promote a current MEMBER to ADMIN", async () => {
    mocks.findMember
      .mockResolvedValueOnce({
        id: "actor_member",
        role: "ADMIN",
        userId: "actor_user",
      })
      .mockResolvedValueOnce({
        id: "target_member",
        role: "MEMBER",
        userId: "target_user",
      });

    await expect(
      updateWorkspaceMemberRole(organizationId, {
        memberId: "target_member",
        role: "ADMIN",
      }),
    ).resolves.toMatchObject({ role: "ADMIN" });
    expect(mocks.updateMember).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "ADMIN" } }),
    );
  });

  it("does not allow an ADMIN to manage an OWNER", async () => {
    mocks.findMember
      .mockResolvedValueOnce({
        id: "actor_member",
        role: "ADMIN",
        userId: "actor_user",
      })
      .mockResolvedValueOnce({
        id: "owner_member",
        role: "OWNER",
        userId: "owner_user",
      });

    await expect(
      removeWorkspaceMember(organizationId, { memberId: "owner_member" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ROLE" });
    expect(mocks.deleteMember).not.toHaveBeenCalled();
  });

  it.each([
    ["ADMIN", "MEMBER"],
    ["MEMBER", "OWNER"],
  ] as const)(
    "allows an OWNER to change %s to %s",
    async (fromRole, toRole) => {
      mocks.findMember
        .mockResolvedValueOnce({
          id: "actor_member",
          role: "OWNER",
          userId: "actor_user",
        })
        .mockResolvedValueOnce({
          id: "target_member",
          role: fromRole,
          userId: "target_user",
        });

      await updateWorkspaceMemberRole(organizationId, {
        memberId: "target_member",
        role: toRole,
      });
      expect(mocks.updateMember).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: toRole } }),
      );
    },
  );

  it.each(["demote", "remove"] as const)(
    "does not %s the last OWNER",
    async (operation) => {
      mocks.findMember
        .mockResolvedValueOnce({
          id: "actor_member",
          role: "OWNER",
          userId: "actor_user",
        })
        .mockResolvedValueOnce({
          id: "owner_member",
          role: "OWNER",
          userId: "owner_user",
        });
      mocks.countOwners.mockResolvedValue(1);

      const promise =
        operation === "demote"
          ? updateWorkspaceMemberRole(organizationId, {
              memberId: "owner_member",
              role: "ADMIN",
            })
          : removeWorkspaceMember(organizationId, {
              memberId: "owner_member",
            });

      await expect(promise).rejects.toMatchObject({
        code: "LAST_OWNER",
      });
      expect(mocks.updateMember).not.toHaveBeenCalled();
      expect(mocks.deleteMember).not.toHaveBeenCalled();
    },
  );

  it("fails safely for a cross-workspace member ID", async () => {
    mocks.findMember
      .mockResolvedValueOnce({
        id: "actor_member",
        role: "OWNER",
        userId: "actor_user",
      })
      .mockResolvedValueOnce(null);

    await expect(
      updateWorkspaceMemberRole(organizationId, {
        memberId: "member_other_workspace",
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({ code: "MEMBER_NOT_FOUND" });
    expect(mocks.findMember).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "member_other_workspace", organizationId },
      }),
    );
    expect(mocks.updateMember).not.toHaveBeenCalled();
  });

  it("keeps role changes and their audit entry workspace scoped", async () => {
    mocks.findMember
      .mockResolvedValueOnce({
        id: "actor_member",
        role: "OWNER",
        userId: "actor_user",
      })
      .mockResolvedValueOnce({
        id: "target_member",
        role: "MEMBER",
        userId: "target_user",
      });

    await updateWorkspaceMemberRole(organizationId, {
      memberId: "target_member",
      role: "ADMIN",
    });

    const auditInput = mocks.createAudit.mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "workspace.member_role_changed",
      actorUserId: "actor_user",
      metadata: { fromRole: "MEMBER", toRole: "ADMIN" },
      organizationId,
      targetId: "target_member",
    });
  });

  it("intentionally rejects self-removal", async () => {
    mocks.findMember
      .mockResolvedValueOnce({
        id: "actor_member",
        role: "OWNER",
        userId: "actor_user",
      })
      .mockResolvedValueOnce({
        id: "actor_member",
        role: "OWNER",
        userId: "actor_user",
      });

    await expect(
      removeWorkspaceMember(organizationId, { memberId: "actor_member" }),
    ).rejects.toMatchObject({ code: "SELF_MANAGEMENT" });
    expect(mocks.deleteMember).not.toHaveBeenCalled();
  });
});
