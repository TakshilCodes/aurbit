import {
  type AurbitEventInput,
  type AurbitEventQueue,
  enqueueAurbitEvent,
  selectEventQueue,
} from "@aurbit/async-events";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRequestLogger } from "./logger";
import { reportUnexpectedError } from "./observability";

export async function enqueueEvent(input: AurbitEventInput) {
  const eventId = crypto.randomUUID();
  try {
    const { env } = getCloudflareContext() as unknown as {
      env: {
        AURBIT_EVENTS?: AurbitEventQueue;
        AURBIT_EVENTS_LOCAL?: AurbitEventQueue;
      };
    };
    const event = await enqueueAurbitEvent(
      selectEventQueue(env, process.env.NODE_ENV === "development"),
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
