import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueEvent } from "./async-events";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@aurbit/async-events", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@aurbit/async-events")>();
  return {
    ...original,
    createEventQueueFromEnvironment: () => ({ send: mocks.send }),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  mocks.send.mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("event producer", () => {
  it("sends the same minimal versioned envelope through the configured adapter", async () => {
    const event = await enqueueEvent({
      type: "report.created",
      reportId: "report_1",
    });

    expect(mocks.send).toHaveBeenCalledWith(event);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(event.eventId),
    );
    expect(Object.keys(event).sort()).toEqual([
      "eventId",
      "occurredAt",
      "reportId",
      "type",
      "version",
    ]);
  });

  it("preserves publish failures and records them without exposing credentials", async () => {
    mocks.send.mockRejectedValue(new Error("Queue unavailable"));

    await expect(
      enqueueEvent({ type: "report.updated", reportId: "report_1" }),
    ).rejects.toThrow("Queue unavailable");
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"message":"async_event_enqueue_failed"'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"eventId":'),
    );
  });
});
