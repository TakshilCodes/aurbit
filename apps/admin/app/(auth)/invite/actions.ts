"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../../lib/authorization";
import {
  acceptWorkspaceInvite,
  WorkspaceInviteError,
} from "../../../lib/workspace-invitations";

export type AcceptInviteState = { error?: string };

export async function acceptWorkspaceInviteAction(
  token: string,
  _previousState: AcceptInviteState,
  _formData: FormData,
): Promise<AcceptInviteState> {
  void _previousState;
  void _formData;
  let organizationId: string;
  try {
    ({ organizationId } = await acceptWorkspaceInvite(token));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { error: "Sign in to accept this invitation." };
    }
    if (error instanceof AuthorizationError) {
      return { error: "This invitation is not available." };
    }
    if (error instanceof WorkspaceInviteError) {
      return { error: error.message };
    }
    return { error: "Couldn't accept this invitation. Try again." };
  }

  revalidatePath("/", "layout");
  redirect(`/organizations/${organizationId}/projects`);
}
