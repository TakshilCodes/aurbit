import { consumeAurbitEventBatch } from "./consumer";
import type { WorkerBindings } from "./environment";
import { createDefaultEventHandlers } from "./handlers";
import { runScheduledMaintenance } from "./scheduled-maintenance";
import { withSentry } from "@sentry/cloudflare";
import { workerSentryOptions } from "./observability";
import { withWorkerLogging } from "./logger";

export { LocalQueueProducer } from "./local-queue-producer";

const workerHandlers = {
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
