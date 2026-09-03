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

it("accepts validated events through the local-only HTTP producer", async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  const response = await worker.fetch(
    new Request("http://127.0.0.1/__aurbit/events", {
      body: JSON.stringify({
        body: {
          eventId: "77d8bc7b-f20c-42c3-905a-a6f3211502d7",
          occurredAt: "2026-08-29T12:00:00.000Z",
          reportId: "report_1",
          type: "report.updated",
          version: 1,
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }) as never,
    {
      AURBIT_ENV: "local",
      LOCAL_AURBIT_EVENTS: { send } as never,
    },
  );

  expect(response.status).toBe(204);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ reportId: "report_1", version: 1 }),
  );
});

it("does not expose the local producer outside the local environment", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/__aurbit/events", {
      method: "POST",
    }) as never,
    { AURBIT_ENV: "production" },
  );

  expect(response.status).toBe(404);
});
