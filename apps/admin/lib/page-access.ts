import type { OrganizationRole } from "@aurbit/db";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationError,
  AuthorizationError,
  requireOrganizationMembership,
  requireProjectAccess,
  requireUser,
} from "./authorization";

function handlePageAccessError(error: unknown): never {
  if (error instanceof AuthenticationError) {
    redirect("/login");
  }

  if (error instanceof AuthorizationError) {
    notFound();
  }

  throw error;
}

export async function requirePageData<Result>(
  operation: () => Promise<Result>,
) {
  try {
    return await operation();
  } catch (error) {
    return handlePageAccessError(error);
  }
}

export function requirePageUser() {
  return requirePageData(requireUser);
}

export async function requirePageOrganization(
  organizationId: string,
  allowedRoles?: readonly OrganizationRole[],
) {
  return requirePageData(() =>
    requireOrganizationMembership(organizationId, allowedRoles),
  );
}

export async function requirePageProject(
  projectId: string,
  organizationId: string,
  allowedRoles?: readonly OrganizationRole[],
) {
  return requirePageData(() =>
    requireProjectAccess(projectId, organizationId, allowedRoles),
  );
}
