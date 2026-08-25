import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMembership: vi.fn(),
  findProject: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("../auth", () => ({ auth: mocks.auth }));
vi.mock("@aurbit/db", () => ({
  db: {
    organizationMember: { findUnique: mocks.findMembership },
    project: { findFirst: mocks.findProject },
    user: { findUnique: mocks.findUser },
  },
}));
import {
  AuthenticationError,
  AuthorizationError,
  PROJECT_MANAGE_ROLES,
  requireOrganizationMembership,
  requireProjectAccess,
  requireUser,
} from "./authorization";

const authMock = mocks.auth;
const findUserMock = mocks.findUser;
const findMembershipMock = mocks.findMembership;
const findProjectMock = mocks.findProject;

function authenticateUser() {
  authMock.mockResolvedValue({
    user: { id: "user_1", sessionVersion: 2 },
  });
  findUserMock.mockResolvedValue({
    id: "user_1",
    email: "member@example.com",
    name: "Member",
    activeOrganizationId: "org_1",
    sessionVersion: 2,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects a revoked session version", async () => {
    authMock.mockResolvedValue({
      user: { id: "user_1", sessionVersion: 1 },
    });
    findUserMock.mockResolvedValue({ id: "user_1", sessionVersion: 2 });

    await expect(requireUser()).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe("organization authorization", () => {
  it("denies access when the user is not a tenant member", async () => {
    authenticateUser();
    findMembershipMock.mockResolvedValue(null);

    await expect(
      requireOrganizationMembership("org_other"),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(findMembershipMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_userId: {
            organizationId: "org_other",
            userId: "user_1",
          },
        },
      }),
    );
  });

  it("denies project management to members", async () => {
    authenticateUser();
    findMembershipMock.mockResolvedValue({
      role: "MEMBER",
      organization: { id: "org_1" },
    });

    await expect(
      requireOrganizationMembership("org_1", PROJECT_MANAGE_ROLES),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it.each(["OWNER", "ADMIN"])(
    "allows the %s role to manage projects",
    async (role) => {
      authenticateUser();
      findMembershipMock.mockResolvedValue({
        role,
        organization: { id: "org_1" },
      });

      await expect(
        requireOrganizationMembership("org_1", PROJECT_MANAGE_ROLES),
      ).resolves.toMatchObject({ membership: { role } });
    },
  );
});

describe("project tenant isolation", () => {
  it("requires the project and membership to match the requested organization", async () => {
    authenticateUser();
    findProjectMock.mockResolvedValue(null);

    await expect(
      requireProjectAccess("project_1", "org_other"),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(findProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "project_1",
          organizationId: "org_other",
          organization: { memberships: { some: { userId: "user_1" } } },
        },
      }),
    );
  });
});
