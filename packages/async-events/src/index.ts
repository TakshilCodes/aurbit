import { z } from "zod";

const eventMetadataSchema = z.object({
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  reportId: z.string().trim().min(1).max(100),
  version: z.literal(1),
});

export const aurbitEventSchema = z.discriminatedUnion("type", [
  eventMetadataSchema.extend({ type: z.literal("report.created") }).strict(),
  eventMetadataSchema.extend({ type: z.literal("report.resolved") }).strict(),
  eventMetadataSchema.extend({ type: z.literal("report.updated") }).strict(),
]);

export type AurbitEvent = z.infer<typeof aurbitEventSchema>;
export type ReportCreatedEvent = Extract<
  AurbitEvent,
  { type: "report.created" }
>;
export type ReportResolvedEvent = Extract<
  AurbitEvent,
  { type: "report.resolved" }
>;
export type AurbitEventInput =
  | { reportId: string; type: "report.created" }
  | { reportId: string; type: "report.updated" }
  | { reportId: string; type: "report.resolved" };

export type ReportUpdatedEvent = Extract<
  AurbitEvent,
  { type: "report.updated" }
>;

export function selectEventQueue(
  bindings: {
    AURBIT_EVENTS?: AurbitEventQueue;
    AURBIT_EVENTS_LOCAL?: AurbitEventQueue;
  },
  development: boolean,
): AurbitEventQueue {
  const queue = development
    ? bindings.AURBIT_EVENTS_LOCAL
    : bindings.AURBIT_EVENTS;
  if (!queue)
    throw new Error(
      development
        ? "Local async events are not configured. Run pnpm dev with the Queue worker."
        : "Async events are not configured. Bind AURBIT_EVENTS to the Aurbit Cloudflare Queue.",
    );
  return queue;
}

export type AurbitEventQueue = {
  send(event: AurbitEvent): Promise<void>;
};

type EventMetadataOverrides = {
  eventId?: string;
  occurredAt?: string;
};

export class InvalidAurbitEventError extends Error {
  constructor() {
    super("Invalid or unsupported Aurbit event.");
    this.name = "InvalidAurbitEventError";
  }
}

export function parseAurbitEvent(value: unknown): AurbitEvent {
  const parsed = aurbitEventSchema.safeParse(value);
  if (!parsed.success) throw new InvalidAurbitEventError();
  return parsed.data;
}

export function createAurbitEvent(
  input: AurbitEventInput,
  metadata: EventMetadataOverrides = {},
): AurbitEvent {
  return parseAurbitEvent({
    ...input,
    eventId: metadata.eventId ?? crypto.randomUUID(),
    occurredAt: metadata.occurredAt ?? new Date().toISOString(),
    version: 1,
  });
}

export async function enqueueAurbitEvent(
  queue: AurbitEventQueue,
  input: AurbitEventInput,
  metadata?: EventMetadataOverrides,
) {
  const event = createAurbitEvent(input, metadata);
  await queue.send(event);
  return event;
}
