import {
  type AurbitEvent,
  InvalidAurbitEventError,
  parseAurbitEvent,
  type ReportCreatedEvent,
  type ReportResolvedEvent,
  type ReportUpdatedEvent,
} from "@aurbit/async-events";
import { webhookRetryDelay } from "@aurbit/webhooks";
import { PermanentEventProcessingError } from "./event-errors";
import { structuredLog } from "./logger";

export type EventHandlers = {
  reportCreated: (event: ReportCreatedEvent) => Promise<void>;
  reportResolved: (event: ReportResolvedEvent) => Promise<void>;
  reportUpdated: (event: ReportUpdatedEvent) => Promise<void>;
};

type QueueMessage = {
  ack(): void;
  attempts: number;
  body: unknown;
  id: string;
  retry(options?: { delaySeconds: number }): void;
};

type QueueBatch = { messages: readonly QueueMessage[]; queue: string };

export async function processAurbitEvent(
  rawEvent: unknown,
  handlers: EventHandlers,
): Promise<AurbitEvent> {
  const event = parseAurbitEvent(rawEvent);

  switch (event.type) {
    case "report.created":
      await handlers.reportCreated(event);
      break;
    case "report.resolved":
      await handlers.reportResolved(event);
      break;
    case "report.updated":
      await handlers.reportUpdated(event);
      break;
  }

  return event;
}

export async function consumeAurbitEventBatch(
  batch: QueueBatch,
  handlers: EventHandlers,
) {
  for (const message of batch.messages) {
    let event: AurbitEvent;

    try {
      event = parseAurbitEvent(message.body);
    } catch (error) {
      if (error instanceof InvalidAurbitEventError) {
        structuredLog("warn", "async_event_rejected", {
          attempts: message.attempts,
          messageId: message.id,
          queue: batch.queue,
        });
        message.ack();
        continue;
      }
      throw error;
    }

    try {
      await processAurbitEvent(event, handlers);
      message.ack();
    } catch (error) {
      if (error instanceof PermanentEventProcessingError) {
        structuredLog("warn", "async_event_permanent_failure", {
          attempts: message.attempts,
          errorCode: error.code,
          eventId: event.eventId,
          eventType: event.type,
          messageId: message.id,
          queue: batch.queue,
          reportId: event.reportId,
        });
        message.ack();
        continue;
      }

      structuredLog("error", "async_event_processing_failed", {
        attempts: message.attempts,
        eventId: event.eventId,
        eventType: event.type,
        messageId: message.id,
        queue: batch.queue,
        reportId: event.reportId,
      });
      message.retry({ delaySeconds: webhookRetryDelay(message.attempts) });
    }
  }
}
