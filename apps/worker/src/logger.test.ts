import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { logger, withWorkerLogging } from "./logger";

const environment = {
  BETTER_STACK_INGESTING_HOST: "test.betterstackdata.com",
  BETTER_STACK_SOURCE_TOKEN: "test-token",
};
const request = vi.fn<typeof fetch>();
function requestBody(index = 0) {
  const body = request.mock.calls[index]?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected serialized JSON");
  return body;
}
beforeEach(() => {
  request.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", request);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps concurrent invocation batches isolated across asynchronous work", async () => {
  let resume!: () => void;
  const hold = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const background: Promise<unknown>[] = [];
  const context = {
    waitUntil: (task: Promise<unknown>) => {
      background.push(task);
    },
  };
  const first = withWorkerLogging(environment, context, async () => {
    logger.info("async_event_processing", { eventId: "event_a" });
    await hold;
    logger.info("async_event_processed", { eventId: "event_a" });
  });
  await withWorkerLogging(environment, context, async () => {
    await Promise.resolve();
    logger.info("async_event_processed", { eventId: "event_b" });
  });
  resume();
  await first;
  await Promise.all(background);
  expect(request).toHaveBeenCalledTimes(2);
  const bodies = request.mock.calls.map((_call, index) => requestBody(index));
  expect(bodies[0]).toContain("event_b");
  expect(bodies[0]).not.toContain("event_a");
  expect(bodies[1]).toContain("event_a");
  expect(bodies[1]).not.toContain("event_b");
});

it("finishes the product operation without waiting for log ingestion", async () => {
  let resolve!: (response: Response) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const context = { waitUntil: vi.fn<(task: Promise<unknown>) => void>() };
  await expect(
    withWorkerLogging(environment, context, async () => {
      await Promise.resolve();
      logger.info("async_event_processed", { eventId: "event_1" });
      return "business_success";
    }),
  ).resolves.toBe("business_success");
  expect(context.waitUntil).toHaveBeenCalledOnce();
  resolve(new Response(null, { status: 202 }));
  await context.waitUntil.mock.calls[0]![0];
});

it("retains job failure while flushing diagnostics and contains exporter failure", async () => {
  request.mockRejectedValueOnce(new Error("private-provider-error"));
  const background: Promise<unknown>[] = [];
  const context = {
    waitUntil: (task: Promise<unknown>) => {
      background.push(task);
    },
  };
  const error = new Error("database unavailable");
  await expect(
    withWorkerLogging(environment, context, async () => {
      await Promise.resolve();
      logger.error("scheduled_maintenance_failed", {
        scheduledRunId: "run_1",
        error,
      });
      throw error;
    }),
  ).rejects.toBe(error);
  await expect(Promise.all(background)).resolves.toEqual([undefined]);
  expect(requestBody()).toContain("run_1");
  expect(requestBody()).not.toContain("database unavailable");
});

it("without credentials neither requires a provider nor changes Queue outcomes", async () => {
  await expect(
    withWorkerLogging({}, { waitUntil: vi.fn() }, async () => {
      await Promise.resolve();
      logger.info("async_event_processed");
      return "ack";
    }),
  ).resolves.toBe("ack");
  expect(request).not.toHaveBeenCalled();
});
