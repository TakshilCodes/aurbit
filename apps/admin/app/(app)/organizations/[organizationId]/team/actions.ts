"use server";

import { ZodError } from "zod";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../../../../lib/authorization";
import {
  removeWorkspaceMember,
  TeamManagementError,
  updateWorkspaceMemberRole,
} from "../../../../../lib/team";
import {
  createWorkspaceInvite,
  resendWorkspaceInvite,
  revokeWorkspaceInvite,
  WorkspaceInviteError,
} from "../../../../../lib/workspace-invitations";

function teamActionError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return "Your session expired. Sign in and try again.";
  }
  if (error instanceof AuthorizationError) {
    return "This workspace is not available.";
  }
  if (
    error instanceof TeamManagementError ||
    error instanceof WorkspaceInviteError
  ) {
    return error.message;
  }
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }
  return "Couldn't update the workspace team. Try again.";
}

function serializeInvite(invite: {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: Date;
  expiresAt: Date;
  lastSentAt: Date;
  invitedBy: { email: string; name: string | null };
}) {
  if (invite.role === "OWNER") {
    throw new WorkspaceInviteError(
      "INSUFFICIENT_ROLE",
      "Owner invitations are not supported.",
    );
  }
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    lastSentAt: invite.lastSentAt.toISOString(),
    invitedBy: invite.invitedBy,
  };
}

export async function createWorkspaceInviteAction(
  organizationId: string,
  input: unknown,
) {
  try {
    const result = await createWorkspaceInvite(organizationId, input);
    return {
      delivery: result.delivery,
      invite: serializeInvite(result.invite),
      success: true,
    } as const;
  } catch (error) {
    return { error: teamActionError(error), success: false } as const;
  }
}

export async function resendWorkspaceInviteAction(
  organizationId: string,
  input: unknown,
) {
  try {
    const result = await resendWorkspaceInvite(organizationId, input);
    return {
      delivery: result.delivery,
      invite: serializeInvite(result.invite),
      success: true,
    } as const;
  } catch (error) {
    return { error: teamActionError(error), success: false } as const;
  }
}

export async function revokeWorkspaceInviteAction(
  organizationId: string,
  input: unknown,
) {
  try {
    const invite = await revokeWorkspaceInvite(organizationId, input);
    return { invite, success: true } as const;
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
