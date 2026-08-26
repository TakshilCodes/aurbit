import { db, type OrganizationRole } from "@aurbit/db";
import { auth } from "../auth";

export class AuthenticationError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor() {
    super("You do not have access to this resource.");
    this.name = "AuthorizationError";
  }
}

export const PROJECT_MANAGE_ROLES = [
  "OWNER",
  "ADMIN",
] as const satisfies readonly OrganizationRole[];

export function assertRole(
  role: OrganizationRole,
  allowedRoles: readonly OrganizationRole[],
) {
  if (!allowedRoles.includes(role)) {
    throw new AuthorizationError();
  }
}

export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new AuthenticationError();
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      image: true,
      name: true,
      activeOrganizationId: true,
      sessionVersion: true,
    },
  });

  if (!user || user.sessionVersion !== session.user.sessionVersion) {
    throw new AuthenticationError();
  }

  return user;
}

export async function requireOrganizationMembership(
  organizationId: string,
  allowedRoles?: readonly OrganizationRole[],
) {
  const user = await requireUser();
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
    include: { organization: true },
  });

  if (!membership) {
    throw new AuthorizationError();
  }

  if (allowedRoles) {
    assertRole(membership.role, allowedRoles);
  }

  return { user, membership, organization: membership.organization };
}

export async function requireProjectAccess(
  projectId: string,
  organizationId: string,
  allowedRoles?: readonly OrganizationRole[],
) {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      organizationId,
      organization: {
        memberships: { some: { userId: user.id } },
      },
    },
    include: {
      organization: {
        include: {
          memberships: { where: { userId: user.id }, take: 1 },
        },
      },
    },
  });
  const membership = project?.organization.memberships[0];

  if (!project || !membership) {
    throw new AuthorizationError();
  }

  if (allowedRoles) {
    assertRole(membership.role, allowedRoles);
  }

  return { user, membership, organization: project.organization, project };
}
