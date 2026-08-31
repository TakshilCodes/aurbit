import { beforeEach, expect, it, vi } from "vitest";
import worker from "./index";
import { runScheduledMaintenance } from "./scheduled-maintenance";
import { consumeAurbitEventBatch } from "./consumer";
import { createDefaultEventHandlers } from "./handlers";

vi.mock("@sentry/cloudflare", () => ({
  withSentry: (_options: unknown, handler: unknown) => handler,
  captureException: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock("./scheduled-maintenance", () => ({
  runScheduledMaintenance: vi.fn(),
}));
vi.mock("./local-queue-producer", () => ({ LocalQueueProducer: class {} }));
vi.mock("./consumer", () => ({ consumeAurbitEventBatch: vi.fn() }));
vi.mock("./handlers", () => ({ createDefaultEventHandlers: vi.fn() }));

const controller = {
  cron: "0 3 * * *",
  scheduledTime: Date.parse("2026-08-30T03:00:00Z"),
  noRetry: vi.fn(),
};
const context = { waitUntil: vi.fn() };

beforeEach(() => vi.resetAllMocks());

it("scheduled handler awaits maintenance using the scheduled time", async () => {
  let complete!: () => void;
  vi.mocked(runScheduledMaintenance).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  let finished = false;
  const execution = worker
    .scheduled(controller, {}, context as unknown as ExecutionContext)
    .then(() => {
      finished = true;
    });
  await Promise.resolve();
  expect(runScheduledMaintenance).toHaveBeenCalledExactlyOnceWith(
    new Date(controller.scheduledTime),
  );
  expect(finished).toBe(false);
  complete();
  await execution;
  expect(finished).toBe(true);
});

it("scheduled handler rejects when maintenance fails", async () => {
  const error = new Error("database unavailable");
  vi.mocked(runScheduledMaintenance).mockRejectedValueOnce(error);
  await expect(
    worker.scheduled(controller, {}, context as unknown as ExecutionContext),
  ).rejects.toBe(error);
});

it("queue entrypoint preserves consumer processing and registers background flush", async () => {
  const batch = { queue: "test", messages: [] } as unknown as MessageBatch;
  await worker.queue(batch, {}, context as unknown as ExecutionContext);
  expect(createDefaultEventHandlers).toHaveBeenCalledExactlyOnceWith({});
  expect(consumeAurbitEventBatch).toHaveBeenCalledOnce();
  expect(context.waitUntil).toHaveBeenCalledOnce();
});
