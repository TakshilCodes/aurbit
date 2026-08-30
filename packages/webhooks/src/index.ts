import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "report.created",
  "report.updated",
  "report.resolved",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
export const WEBHOOK_POLICY = {
  maxEndpoints: 10,
  maxAttempts: 4,
  timeoutMs: 8_000,
  historyPageSize: 20,
  leaseMs: 60_000,
} as const;
export const webhookInputSchema = z
  .object({
    url: z.string().trim().min(1).max(2_048),
    events: z
      .array(z.enum(WEBHOOK_EVENTS))
      .min(1, "Choose at least one event.")
      .max(3)
      .transform((events) => [...new Set(events)].sort()),
  })
  .strict();
export type WebhookInput = z.input<typeof webhookInputSchema>;
export class WebhookConfigurationError extends Error {}

export function webhookRetryDelay(attempt: number) {
  return Math.min(900, 30 * 2 ** Math.max(0, attempt - 1));
}
