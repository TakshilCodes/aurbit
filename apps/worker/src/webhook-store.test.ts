import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  endpoints: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@aurbit/db", () => ({
  db: {
    webhookEndpoint: { findMany: mocks.endpoints },
    webhookDelivery: { upsert: mocks.upsert, updateMany: mocks.update },
  },
}));
import { webhookStore } from "./webhook-store";
it("cleans up disabled endpoint retries including expired, but not active, leases", async () => {
  await webhookStore.skipInactive("org_1", "event_1", "report.created");
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        eventId: "event_1",
        status: { in: ["PENDING", "RETRYABLE_FAILURE", "DELIVERING"] },
        endpoint: {
          organizationId: "org_1",
          OR: [
            { enabled: false },
            { NOT: { events: { has: "report.created" } } },
          ],
        },
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lte: expect.any(Date) as unknown } },
        ],
      }) as unknown,
      data: {
        status: "SKIPPED",
        lastError: "endpoint_disabled",
        lockedUntil: null,
        lockToken: null,
      },
    }),
  );
});
it("selects only active tenant endpoints subscribed before the event", async () => {
  await webhookStore.endpoints(
    "org_1",
    "report.updated",
    "2026-08-30T00:00:00Z",
  );
  expect(mocks.endpoints).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        organizationId: "org_1",
        enabled: true,
        events: { has: "report.updated" },
        createdAt: { lte: new Date("2026-08-30T00:00:00Z") },
      },
      take: 10,
    }),
  );
});
it("uses the unique endpoint/event key and does not replace existing payload", async () => {
  await webhookStore.delivery(
    "endpoint_1",
    "event_1",
    "report.created",
    "payload",
  );
  expect(mocks.upsert).toHaveBeenCalledWith({
    where: {
      webhookEndpointId_eventId: {
        webhookEndpointId: "endpoint_1",
        eventId: "event_1",
      },
    },
    create: {
      webhookEndpointId: "endpoint_1",
      eventId: "event_1",
      eventType: "report.created",
      payload: "payload",
    },
    update: {},
  });
});
it("claims an expired/unlocked lease atomically and guards completion by token", async () => {
  mocks.update.mockResolvedValue({ count: 1 });
  const now = new Date();
  expect(await webhookStore.claim("delivery_1", "token", now)).toBe(true);
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: "delivery_1",
        status: { in: ["PENDING", "RETRYABLE_FAILURE", "DELIVERING"] },
        attemptCount: { lt: 4 },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: expect.objectContaining({
        lockToken: "token",
        attemptCount: { increment: 1 },
      }) as unknown,
    }),
  );
  await webhookStore.finish("delivery_1", "token", { status: "DELIVERED" });
  expect(mocks.update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: { id: "delivery_1", lockToken: "token" },
    }),
  );
  mocks.update.mockResolvedValue({ count: 0 });
  await expect(
    webhookStore.finish("delivery_1", "stale", { status: "DELIVERED" }),
  ).rejects.toThrow("lease_lost");
});
