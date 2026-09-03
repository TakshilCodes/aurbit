import {
  InvalidAurbitEventError,
  parseAurbitEvent,
} from "@aurbit/async-events";
import { consumeAurbitEventBatch } from "./consumer";
import type { WorkerBindings } from "./environment";
import { createDefaultEventHandlers } from "./handlers";
import { runScheduledMaintenance } from "./scheduled-maintenance";
import { withSentry } from "@sentry/cloudflare";
import { workerSentryOptions } from "./observability";
import { withWorkerLogging } from "./logger";

const LOCAL_EVENT_PATH = "/__aurbit/events";

function localEventBody(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("body" in value)
  ) {
    throw new InvalidAurbitEventError();
  }
  return value.body;
}

const workerHandlers = {
  async fetch(request, environment): Promise<Response> {
    const url = new URL(request.url);
    if (
      environment.AURBIT_ENV !== "local" ||
      url.pathname !== LOCAL_EVENT_PATH
    ) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        headers: { Allow: "POST" },
        status: 405,
      });
    }

    try {
      const event = parseAurbitEvent(localEventBody(await request.json()));
      if (!environment.LOCAL_AURBIT_EVENTS) {
        return new Response("Queue unavailable", { status: 503 });
      }
      await environment.LOCAL_AURBIT_EVENTS.send(event);
      return new Response(null, { status: 204 });
    } catch (error) {
      if (
        error instanceof InvalidAurbitEventError ||
        error instanceof SyntaxError
      ) {
        return new Response("Invalid event", { status: 400 });
      }
      throw error;
    }
  },
  async scheduled(controller, environment, context): Promise<void> {
    await withWorkerLogging(environment, context, () =>
      runScheduledMaintenance(new Date(controller.scheduledTime)),
    );
  },
  async queue(batch, environment, context): Promise<void> {
    await withWorkerLogging(environment, context, () =>
      consumeAurbitEventBatch(batch, createDefaultEventHandlers(environment)),
    );
  },
} satisfies ExportedHandler<WorkerBindings>;

export default withSentry(workerSentryOptions, workerHandlers);
