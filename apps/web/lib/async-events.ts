import {
  type AurbitEventInput,
  createEventQueueFromEnvironment,
  enqueueAurbitEvent,
} from "@aurbit/async-events";
import { getRequestLogger } from "./logger";
import { reportUnexpectedError } from "./observability";

export async function enqueueEvent(input: AurbitEventInput) {
  const eventId = crypto.randomUUID();
  try {
    const event = await enqueueAurbitEvent(
      createEventQueueFromEnvironment(process.env),
      input,
      { eventId },
    );
    (await getRequestLogger()).info("async_event_enqueued", {
      eventId,
      eventType: event.type,
      reportId: event.reportId,
    });
    return event;
  } catch (error) {
    await reportUnexpectedError("async_event_enqueue_failed", error, {
      eventId,
      eventType: input.type,
      reportId: input.reportId,
    });
    throw error;
  }
}
