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

export async function requirePageUser() {
  try {
    return await requireUser();
  } catch (error) {
    return handlePageAccessError(error);
  }
}

export async function requirePageOrganization(
  organizationId: string,
  allowedRoles?: readonly OrganizationRole[],
) {
  try {
    return await requireOrganizationMembership(organizationId, allowedRoles);
  } catch (error) {
    return handlePageAccessError(error);
  }
}

export async function requirePageProject(
  projectId: string,
  organizationId: string,
  allowedRoles?: readonly OrganizationRole[],
) {
  try {
    return await requireProjectAccess(projectId, organizationId, allowedRoles);
  } catch (error) {
    return handlePageAccessError(error);
  }
}
