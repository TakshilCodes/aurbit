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
export type ReportUpdatedEvent = Extract<
  AurbitEvent,
  { type: "report.updated" }
>;
export type AurbitEventInput =
  | { reportId: string; type: "report.created" }
  | { reportId: string; type: "report.updated" }
  | { reportId: string; type: "report.resolved" };

export type AurbitEventQueue = {
  send(event: AurbitEvent): Promise<void>;
};

type EventMetadataOverrides = {
  eventId?: string;
  occurredAt?: string;
};

type ProducerEnvironment = {
  AURBIT_LOCAL_QUEUE_URL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_QUEUE_API_TOKEN?: string;
  CLOUDFLARE_QUEUE_ID?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  NODE_ENV?: string;
};

const cloudflareQueueResponseSchema = z
  .object({ success: z.literal(true) })
  .passthrough();

const cloudflareQueueEnvironmentSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/i),
  CLOUDFLARE_QUEUE_API_TOKEN: z.string().trim().min(1),
  CLOUDFLARE_QUEUE_ID: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/i),
});

const localQueueUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    );
  }, "Local Queue URL must use HTTP on a loopback host.");

export class InvalidAurbitEventError extends Error {
  constructor() {
    super("Invalid or unsupported Aurbit event.");
    this.name = "InvalidAurbitEventError";
  }
}

export class AurbitEventPublishError extends Error {
  constructor() {
    super("Unable to publish the asynchronous event.");
    this.name = "AurbitEventPublishError";
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

function createHttpEventQueue(
  url: string,
  fetcher: typeof fetch,
  apiToken?: string,
): AurbitEventQueue {
  return {
    async send(event) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);

      let response: Response;
      try {
        response = await fetcher(url, {
          body: JSON.stringify({ body: event }),
          headers,
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        throw new AurbitEventPublishError();
      }

      if (!response.ok) throw new AurbitEventPublishError();

      if (apiToken) {
        try {
          if (
            !cloudflareQueueResponseSchema.safeParse(await response.json())
              .success
          ) {
            throw new AurbitEventPublishError();
          }
        } catch (error) {
          if (error instanceof AurbitEventPublishError) throw error;
          throw new AurbitEventPublishError();
        }
      }
    },
  };
}

export function createEventQueueFromEnvironment(
  environment: ProducerEnvironment,
  fetcher: typeof fetch = fetch,
): AurbitEventQueue {
  if (
    environment.NEXT_PUBLIC_APP_ENV === "local" ||
    environment.NODE_ENV === "development"
  ) {
    const url = localQueueUrlSchema.parse(
      environment.AURBIT_LOCAL_QUEUE_URL ??
        "http://127.0.0.1:8787/__aurbit/events",
    );
    return createHttpEventQueue(url, fetcher);
  }

  const parsed = cloudflareQueueEnvironmentSchema.parse(environment);
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${parsed.CLOUDFLARE_ACCOUNT_ID}` +
    `/queues/${parsed.CLOUDFLARE_QUEUE_ID}/messages`;

  return createHttpEventQueue(url, fetcher, parsed.CLOUDFLARE_QUEUE_API_TOKEN);
}
