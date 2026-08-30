"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { WebhookConfigurationError } from "@aurbit/webhooks";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../../../../lib/authorization";
import {
  createWorkspaceWebhook,
  mutateWorkspaceWebhook,
} from "../../../../../lib/webhooks";

export type WebhookActionResult =
  | { success: true; secret?: string }
  | { success: false; error: string };

async function run(
  organizationId: string,
  operation: () => Promise<{ secret?: string }>,
): Promise<WebhookActionResult> {
  try {
    const result = await operation();
    revalidatePath(`/organizations/${organizationId}/webhooks`);
    revalidatePath(`/organizations/${organizationId}/audit`);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof AuthenticationError)
      return { success: false, error: "Sign in to manage webhooks." };
    if (error instanceof AuthorizationError)
      return {
        success: false,
        error: "You cannot manage this webhook in this workspace.",
      };
    if (error instanceof z.ZodError)
      return {
        success: false,
        error: "Enter a valid URL and select at least one supported event.",
      };
    if (error instanceof WebhookConfigurationError)
      return { success: false, error: error.message };
    return {
      success: false,
      error:
        "Unable to save this webhook. Check the destination and configuration, then try again.",
    };
  }
}

export async function createWebhookAction(
  organizationId: string,
  input: unknown,
) {
  return run(organizationId, () =>
    createWorkspaceWebhook(organizationId, input),
  );
}

export async function mutateWebhookAction(
  organizationId: string,
  endpointId: string,
  input: unknown,
) {
  return run(organizationId, () =>
    mutateWorkspaceWebhook(organizationId, endpointId, input),
  );
}
