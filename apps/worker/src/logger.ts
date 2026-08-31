import { createLogger, runtimeEnvironment } from "@aurbit/logger";
import { createBetterStackBatch } from "@aurbit/logger/better-stack";
import { AsyncLocalStorage } from "node:async_hooks";
import type { WorkerBindings } from "./environment";

const batches = new AsyncLocalStorage<
  ReturnType<typeof createBetterStackBatch>
>();

export async function withWorkerLogging<T>(
  environment: WorkerBindings,
  context: Pick<ExecutionContext, "waitUntil">,
  operation: () => Promise<T>,
): Promise<T> {
  const batch = createBetterStackBatch({
    host: environment.BETTER_STACK_INGESTING_HOST,
    token: environment.BETTER_STACK_SOURCE_TOKEN,
  });
  return batches.run(batch, async () => {
    try {
      return await operation();
    } finally {
      // Export cannot delay acknowledgment, trigger Queue retries or hide job errors.
      try {
        context.waitUntil(batch.flush());
      } catch {
        /* No active runtime lifecycle; stdout is still available. */
      }
    }
  });
}

// nodejs_compat populates process.env at invocation time. Keep the portable
// logger independent of Node typings and read only these two configuration keys.
const runtime = globalThis as typeof globalThis & {
  process?: { env?: { AURBIT_ENV?: string; NODE_ENV?: string } };
};

export const logger = createLogger({
  sink: (record) => batches.getStore()?.write(record),
  service: "aurbit-worker",
  environment: () =>
    runtimeEnvironment(
      runtime.process?.env?.AURBIT_ENV,
      runtime.process?.env?.NODE_ENV,
    ),
});
