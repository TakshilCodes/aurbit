import { consumeAurbitEventBatch } from "./consumer";
import type { WorkerBindings } from "./environment";
import { createDefaultEventHandlers } from "./handlers";
import { runScheduledMaintenance } from "./scheduled-maintenance";

export { LocalQueueProducer } from "./local-queue-producer";

export default {
  async scheduled(controller): Promise<void> {
    await runScheduledMaintenance(new Date(controller.scheduledTime));
  },
  async queue(batch, environment): Promise<void> {
    await consumeAurbitEventBatch(
      batch,
      createDefaultEventHandlers(environment),
    );
  },
} satisfies ExportedHandler<WorkerBindings>;
