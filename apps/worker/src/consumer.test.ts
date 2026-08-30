import type { AurbitEvent } from "@aurbit/async-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeAurbitEventBatch,
  type EventHandlers,
  processAurbitEvent,
} from "./consumer";
import { PermanentEventProcessingError } from "./event-errors";

const event: AurbitEvent = {
  eventId: "77d8bc7b-f20c-42c3-905a-a6f3211502d7",
  occurredAt: "2026-08-29T12:00:00.000Z",
  reportId: "report_1",
  type: "report.created",
  version: 1,
};

function handlers(): EventHandlers {
  return {
    reportCreated: vi.fn(() => Promise.resolve()),
    reportResolved: vi.fn(() => Promise.resolve()),
    reportUpdated: vi.fn(() => Promise.resolve()),
  };
}

function message(body: unknown = event) {
  return {
    ack: vi.fn(),
    attempts: 1,
    body,
    id: "message_1",
    retry: vi.fn(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("Aurbit queue consumer", () => {
  it("routes report.updated and uses bounded exponential Queue retry delays", async () => {
    const eventHandlers = handlers();
    const updated = { ...event, type: "report.updated" };
    await processAurbitEvent(updated, eventHandlers);
    expect(eventHandlers.reportUpdated).toHaveBeenCalledWith(updated);
    vi.mocked(eventHandlers.reportUpdated).mockRejectedValue(
      new Error("retry"),
    );
    const queueMessage = { ...message(updated), attempts: 3 };
    await consumeAurbitEventBatch(
      { messages: [queueMessage], queue: "test" },
      eventHandlers,
    );
    expect(queueMessage.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
    expect(queueMessage.ack).not.toHaveBeenCalled();
  });
  it("routes report.created to its handler", async () => {
    const eventHandlers = handlers();

    await expect(processAurbitEvent(event, eventHandlers)).resolves.toEqual(
      event,
    );
    expect(eventHandlers.reportCreated).toHaveBeenCalledWith(event);
    expect(eventHandlers.reportResolved).not.toHaveBeenCalled();
  });

  it("rejects malformed and unsupported events", async () => {
    const eventHandlers = handlers();

    await expect(
      processAurbitEvent({ ...event, type: "report.deleted" }, eventHandlers),
    ).rejects.toThrow("Invalid or unsupported Aurbit event.");
    expect(eventHandlers.reportCreated).not.toHaveBeenCalled();
  });

  it("acknowledges a successfully processed message", async () => {
    const queueMessage = message();

    await consumeAurbitEventBatch(
      { messages: [queueMessage], queue: "aurbit-events-local" },
      handlers(),
    );

    expect(queueMessage.ack).toHaveBeenCalledOnce();
    expect(queueMessage.retry).not.toHaveBeenCalled();
  });

  it("acknowledges a malformed poison message without running handlers", async () => {
    const queueMessage = message({ token: "not-an-event" });
    const eventHandlers = handlers();

    await consumeAurbitEventBatch(
      { messages: [queueMessage], queue: "aurbit-events-local" },
      eventHandlers,
    );

    expect(queueMessage.ack).toHaveBeenCalledOnce();
    expect(queueMessage.retry).not.toHaveBeenCalled();
    expect(eventHandlers.reportCreated).not.toHaveBeenCalled();
  });

  it("retries a handler failure without falsely acknowledging it", async () => {
    const queueMessage = message();
    const eventHandlers = handlers();
    vi.mocked(eventHandlers.reportCreated).mockRejectedValue(
      new Error("temporary dependency failure"),
    );

    await consumeAurbitEventBatch(
      { messages: [queueMessage], queue: "aurbit-events-local" },
      eventHandlers,
    );

    expect(queueMessage.retry).toHaveBeenCalledOnce();
    expect(queueMessage.ack).not.toHaveBeenCalled();
  });

  it("acknowledges an intentionally permanent processing failure", async () => {
    const queueMessage = message();
    const eventHandlers = handlers();
    vi.mocked(eventHandlers.reportCreated).mockRejectedValue(
      new PermanentEventProcessingError("report_not_found"),
    );

    await consumeAurbitEventBatch(
      { messages: [queueMessage], queue: "aurbit-events-local" },
      eventHandlers,
    );

    expect(queueMessage.ack).toHaveBeenCalledOnce();
    expect(queueMessage.retry).not.toHaveBeenCalled();
  });

  it("continues processing siblings after one message fails", async () => {
    const failed = message();
    const succeeded = { ...message(), id: "message_2" };
    const eventHandlers = handlers();
    vi.mocked(eventHandlers.reportCreated)
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(undefined);

    await consumeAurbitEventBatch(
      { messages: [failed, succeeded], queue: "aurbit-events-local" },
      eventHandlers,
    );

    expect(failed.retry).toHaveBeenCalledOnce();
    expect(succeeded.ack).toHaveBeenCalledOnce();
  });
});
