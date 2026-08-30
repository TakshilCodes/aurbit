import { consumeAurbitEventBatch } from "./consumer";
import type { WorkerBindings } from "./environment";
import { createDefaultEventHandlers } from "./handlers";

export { LocalQueueProducer } from "./local-queue-producer";

export default {
  async queue(batch, environment): Promise<void> {
    await consumeAurbitEventBatch(
      batch,
      createDefaultEventHandlers(environment),
    );
  },
} satisfies ExportedHandler<WorkerBindings>;
