"use server";

import { ZodError } from "zod";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../../../../lib/authorization";
import {
  addWorkspaceMember,
  removeWorkspaceMember,
  TeamManagementError,
  updateWorkspaceMemberRole,
} from "../../../../../lib/team";

function teamActionError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return "Your session expired. Sign in and try again.";
  }

  if (error instanceof AuthorizationError) {
    return "This workspace is not available.";
  }

  if (error instanceof TeamManagementError) return error.message;
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }

  return "Couldn't update the workspace team. Try again.";
}

export async function addWorkspaceMemberAction(
  organizationId: string,
  input: unknown,
) {
  try {
    const member = await addWorkspaceMember(organizationId, input);
    return {
      member: { ...member, createdAt: member.createdAt.toISOString() },
      success: true,
    } as const;
  } catch (error) {
    return { error: teamActionError(error), success: false } as const;
  }
}

export async function updateWorkspaceMemberRoleAction(
  organizationId: string,
  input: unknown,
) {
  try {
    const member = await updateWorkspaceMemberRole(organizationId, input);
    return { member, success: true } as const;
  } catch (error) {
    return { error: teamActionError(error), success: false } as const;
  }
}

export async function removeWorkspaceMemberAction(
  organizationId: string,
  input: unknown,
) {
  try {
    const member = await removeWorkspaceMember(organizationId, input);
    return { member, success: true } as const;
  } catch (error) {
    return { error: teamActionError(error), success: false } as const;
  }
}
