import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AurbitEvent } from "@aurbit/async-events";
import { deliverReportWebhooks } from "./webhooks";
import type { WebhookStore } from "./webhook-store";
import { sendWebhook } from "./webhook-request";
import {
  PermanentEventProcessingError,
  RetryableEventProcessingError,
} from "./event-errors";

vi.mock("@aurbit/db", () => ({ db: {} }));
const event: AurbitEvent = {
  type: "report.created",
  version: 1,
  eventId: "77d8bc7b-f20c-42c3-905a-a6f3211502d7",
  occurredAt: "2026-08-30T00:00:00Z",
  reportId: "report_1",
};
const report = {
  id: "report_1",
  organizationId: "org_1",
  title: "Safe title",
  status: "OPEN" as const,
  priority: "MEDIUM" as const,
  project: { publicKey: "public_key" },
};
const endpoints = ["endpoint_1", "endpoint_2"].map((id) => ({
  id,
  organizationId: "org_1",
  url: `https://${id}.example.com/hook`,
  secretEncrypted: "ciphertext",
  enabled: true,
  events: ["report.created"],
}));
type Delivery = Awaited<ReturnType<WebhookStore["delivery"]>>;
let rows: Map<string, Delivery>;
const store = {
  skipInactive: vi.fn<WebhookStore["skipInactive"]>(),
  report: vi.fn<WebhookStore["report"]>(),
  endpoints: vi.fn<WebhookStore["endpoints"]>(),
  endpoint: vi.fn<WebhookStore["endpoint"]>(),
  delivery: vi.fn<WebhookStore["delivery"]>(),
  claim: vi.fn<WebhookStore["claim"]>(),
  finish: vi.fn<WebhookStore["finish"]>(),
  exhaust: vi.fn<WebhookStore["exhaust"]>(),
};
const send = vi.fn<typeof sendWebhook>();
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  rows = new Map();
  store.report.mockResolvedValue(report);
  store.endpoints.mockResolvedValue(endpoints);
  store.endpoint.mockImplementation((id) =>
    Promise.resolve(endpoints.find((endpoint) => endpoint.id === id) ?? null),
  );
  store.delivery.mockImplementation(
    (endpointId, eventId, eventType, payload) => {
      const id = `${endpointId}:${eventId}`;
      let row = rows.get(id);
      if (!row) {
        row = {
          id,
          webhookEndpointId: endpointId,
          eventId,
          eventType,
          payload,
          status: "PENDING",
          attemptCount: 0,
          responseStatus: null,
          lastError: null,
          deliveredAt: null,
          lockedUntil: null,
          lockToken: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(id, row);
      }
      return Promise.resolve({ ...row });
    },
  );
  store.claim.mockImplementation((id, token) => {
    const row = rows.get(id);
    if (!row || row.lockToken) return Promise.resolve(false);
    row.lockToken = token;
    row.attemptCount++;
    row.status = "DELIVERING";
    return Promise.resolve(true);
  });
  store.finish.mockImplementation((id, token, data) => {
    const row = rows.get(id);
    if (!row || row.lockToken !== token)
      return Promise.reject(new Error("lost lease"));
    Object.assign(row, data, { lockToken: null, lockedUntil: null });
    return Promise.resolve();
  });
  send.mockResolvedValue({ status: 200, retryable: false, error: null });
});
describe("durable webhook delivery", () => {
  it("loads tenant subscriptions and freezes minimal payload; replay does not resend", async () => {
    await deliverReportWebhooks(event, {}, { store, send });
    expect(store.endpoints).toHaveBeenCalledWith(
      "org_1",
      "report.created",
      event.occurredAt,
    );
    expect(rows.size).toBe(2);
    expect(
      [...rows.values()].every(
        (row) => row.status === "DELIVERED" && row.attemptCount === 1,
      ),
    ).toBe(true);
    const body = send.mock.calls[0]?.[0].body;
    expect(JSON.parse(body ?? "null")).toEqual({
      id: event.eventId,
      type: event.type,
      version: 1,
      createdAt: event.occurredAt,
      data: {
        reportId: report.id,
        projectKey: report.project.publicKey,
        title: report.title,
        status: "OPEN",
        priority: "MEDIUM",
      },
    });
    await deliverReportWebhooks(event, {}, { store, send });
    expect(send).toHaveBeenCalledTimes(2);
    expect(rows.size).toBe(2);
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      "ciphertext",
    );
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      "Safe title",
    );
  });
  it("does not redeliver successful endpoints when another needs retry", async () => {
    send.mockResolvedValueOnce({
      status: 503,
      retryable: true,
      error: "http_error",
    });
    await expect(
      deliverReportWebhooks(event, {}, { store, send }),
    ).rejects.toBeInstanceOf(RetryableEventProcessingError);
    expect(send).toHaveBeenCalledTimes(2);
    store.report.mockResolvedValue({
      ...report,
      title: "Changed after attempt",
    });
    await deliverReportWebhooks(event, {}, { store, send });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2]?.[0].body).toBe(send.mock.calls[0]?.[0].body);
    expect([...rows.values()].map((row) => row.attemptCount)).toEqual([2, 1]);
  });
  it("marks permanent failure and still delivers to other endpoints", async () => {
    send.mockResolvedValueOnce({
      status: 410,
      retryable: false,
      error: "http_error",
    });
    await deliverReportWebhooks(event, {}, { store, send });
    expect([...rows.values()].map((row) => row.status)).toEqual([
      "FAILED",
      "DELIVERED",
    ]);
    await deliverReportWebhooks(event, {}, { store, send });
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("caps attempts and never reports a failed send as delivered", async () => {
    send.mockResolvedValue({
      status: 429,
      retryable: true,
      error: "http_error",
    });
    for (let attempt = 0; attempt < 4; attempt++)
      await expect(
        deliverReportWebhooks(event, {}, { store, send }),
      ).rejects.toBeInstanceOf(RetryableEventProcessingError);
    expect(
      [...rows.values()].every(
        (row) =>
          row.status === "FAILED" && row.attemptCount === 4 && !row.deliveredAt,
      ),
    ).toBe(true);
    await deliverReportWebhooks(event, {}, { store, send });
    expect(send).toHaveBeenCalledTimes(8);
  });
  it("does not send when another delivery holds the lease", async () => {
    store.claim.mockResolvedValue(false);
    await expect(
      deliverReportWebhooks(event, {}, { store, send }),
    ).rejects.toBeInstanceOf(RetryableEventProcessingError);
    expect(send).not.toHaveBeenCalled();
  });
  it("skips disabled/revoked subscriptions rechecked just before delivery", async () => {
    store.endpoint.mockResolvedValue({ ...endpoints[0]!, enabled: false });
    await deliverReportWebhooks(event, {}, { store, send });
    expect(send).not.toHaveBeenCalled();
    expect([...rows.values()].every((row) => row.status === "SKIPPED")).toBe(
      true,
    );
  });
  it("missing report is permanent and sends nothing", async () => {
    store.report.mockResolvedValue(null);
    await expect(
      deliverReportWebhooks(event, {}, { store, send }),
    ).rejects.toBeInstanceOf(PermanentEventProcessingError);
    expect(send).not.toHaveBeenCalled();
  });
  it("local bypass is unavailable in production even if flag is set", async () => {
    await deliverReportWebhooks(
      event,
      { AURBIT_ENV: "production", WEBHOOK_LOCAL_TESTING: "true" },
      { store, send },
    );
    expect(send.mock.calls[0]?.[0].allowLocal).toBe(false);
  });
});
