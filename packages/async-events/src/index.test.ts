import { describe, expect, it, vi } from "vitest";
import {
  createAurbitEvent,
  enqueueAurbitEvent,
  InvalidAurbitEventError,
  parseAurbitEvent,
} from "./index";

const eventId = "77d8bc7b-f20c-42c3-905a-a6f3211502d7";
const occurredAt = "2026-08-29T12:00:00.000Z";

describe("Aurbit async events", () => {
  it.each(["report.created", "report.resolved"] as const)(
    "accepts a valid %s event",
    (type) => {
      expect(
        parseAurbitEvent({
          eventId,
          occurredAt,
          reportId: "report_1",
          type,
          version: 1,
        }),
      ).toMatchObject({ eventId, reportId: "report_1", type, version: 1 });
    },
  );

  it.each([
    { type: "report.created", version: 2 },
    { type: "report.deleted", version: 1 },
    { type: "report.created", version: 1, reportId: "" },
  ])("rejects malformed or unsupported events", (override) => {
    expect(() =>
      parseAurbitEvent({
        eventId,
        occurredAt,
        reportId: "report_1",
        ...override,
      }),
    ).toThrow(InvalidAurbitEventError);
  });

  it("generates event metadata and preserves explicitly supplied IDs", () => {
    const generated = createAurbitEvent(
      { reportId: "report_1", type: "report.created" },
      { eventId, occurredAt },
    );

    expect(generated).toEqual({
      eventId,
      occurredAt,
      reportId: "report_1",
      type: "report.created",
      version: 1,
    });
  });

  it("sends only the minimal validated event envelope", async () => {
    const queue = { send: vi.fn(() => Promise.resolve()) };

    await expect(
      enqueueAurbitEvent(
        queue,
        { reportId: "report_1", type: "report.created" },
        { eventId, occurredAt },
      ),
    ).resolves.toMatchObject({ eventId, type: "report.created" });
    expect(queue.send).toHaveBeenCalledWith({
      eventId,
      occurredAt,
      reportId: "report_1",
      type: "report.created",
      version: 1,
    });
  });
});
