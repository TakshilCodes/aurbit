import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueEvent } from "./async-events";

const mocks = vi.hoisted(() => ({
  directSend: vi.fn(),
  localSend: vi.fn(),
  context: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.context,
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  mocks.context.mockReturnValue({
    env: {
      AURBIT_EVENTS: { send: mocks.directSend },
      AURBIT_EVENTS_LOCAL: { send: mocks.localSend },
    },
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("event producer runtime selection", () => {
  it("uses the real Queue binding outside Next development", async () => {
    const event = await enqueueEvent({
      type: "report.created",
      reportId: "report_1",
    });
    expect(mocks.directSend).toHaveBeenCalledWith(event);
    expect(mocks.localSend).not.toHaveBeenCalled();
    expect(Object.keys(event).sort()).toEqual([
      "eventId",
      "occurredAt",
      "reportId",
      "type",
      "version",
    ]);
  });

  it("sends the same minimal envelope through the local Queue bridge in Next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const event = await enqueueEvent({
      type: "report.created",
      reportId: "report_1",
    });
    expect(mocks.localSend).toHaveBeenCalledWith(event);
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.directSend).not.toHaveBeenCalled();
  });

  it("does not silently use an unconnected simulator when the local bridge is absent", () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.context.mockReturnValue({
      env: { AURBIT_EVENTS: { send: mocks.directSend } },
    });
    expect(() =>
      enqueueEvent({ type: "report.created", reportId: "report_1" }),
    ).toThrow("Local async events are not configured");
    expect(mocks.directSend).not.toHaveBeenCalled();
  });

  it("does not fall back to the local bridge when the production Queue is missing", () => {
    mocks.context.mockReturnValue({
      env: { AURBIT_EVENTS_LOCAL: { send: mocks.localSend } },
    });
    expect(() =>
      enqueueEvent({ type: "report.created", reportId: "report_1" }),
    ).toThrow("Async events are not configured");
    expect(mocks.localSend).not.toHaveBeenCalled();
  });

  it("propagates local dispatch failures", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.localSend.mockRejectedValue(new Error("Worker is unavailable"));
    await expect(
      enqueueEvent({ type: "report.created", reportId: "report_1" }),
    ).rejects.toThrow("Worker is unavailable");
    expect(mocks.directSend).not.toHaveBeenCalled();
  });
});
