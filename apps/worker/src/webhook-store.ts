import { db, type Prisma } from "@aurbit/db";
import { WEBHOOK_POLICY } from "@aurbit/webhooks";

const endpointSelect = {
  id: true,
  organizationId: true,
  url: true,
  secretEncrypted: true,
  events: true,
  enabled: true,
} as const;

export const webhookStore = {
  async skipInactive(
    organizationId: string,
    eventId: string,
    eventType: string,
  ) {
    await db.webhookDelivery.updateMany({
      where: {
        eventId,
        status: { in: ["PENDING", "RETRYABLE_FAILURE", "DELIVERING"] },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
        endpoint: {
          organizationId,
          OR: [{ enabled: false }, { NOT: { events: { has: eventType } } }],
        },
      },
      data: {
        status: "SKIPPED",
        lastError: "endpoint_disabled",
        lockedUntil: null,
        lockToken: null,
      },
    });
  },
  async report(reportId: string) {
    return db.bugReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
        priority: true,
        project: { select: { publicKey: true } },
      },
    });
  },
  async endpoints(
    organizationId: string,
    eventType: string,
    occurredAt: string,
  ) {
    return db.webhookEndpoint.findMany({
      where: {
        organizationId,
        enabled: true,
        events: { has: eventType },
        createdAt: { lte: new Date(occurredAt) },
      },
      select: endpointSelect,
      orderBy: { id: "asc" },
      take: WEBHOOK_POLICY.maxEndpoints,
    });
  },
  async endpoint(id: string, organizationId: string) {
    return db.webhookEndpoint.findFirst({
      where: { id, organizationId },
      select: endpointSelect,
    });
  },
  async delivery(
    endpointId: string,
    eventId: string,
    eventType: string,
    payload: string,
  ) {
    return db.webhookDelivery.upsert({
      where: {
        webhookEndpointId_eventId: { webhookEndpointId: endpointId, eventId },
      },
      create: { webhookEndpointId: endpointId, eventId, eventType, payload },
      update: {},
    });
  },
  async claim(id: string, lockToken: string, now: Date) {
    const result = await db.webhookDelivery.updateMany({
      where: {
        id,
        status: { in: ["PENDING", "RETRYABLE_FAILURE", "DELIVERING"] },
        attemptCount: { lt: WEBHOOK_POLICY.maxAttempts },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: {
        status: "DELIVERING",
        lockToken,
        lockedUntil: new Date(now.getTime() + WEBHOOK_POLICY.leaseMs),
        attemptCount: { increment: 1 },
      },
    });
    return result.count === 1;
  },
  async finish(
    id: string,
    lockToken: string,
    data: Pick<
      Prisma.WebhookDeliveryUpdateManyMutationInput,
      "status" | "responseStatus" | "lastError" | "deliveredAt"
    >,
  ) {
    const result = await db.webhookDelivery.updateMany({
      where: { id, lockToken },
      data: {
        ...data,
        lockedUntil: null,
        lockToken: null,
      },
    });
    if (result.count !== 1) throw new Error("delivery_lease_lost");
  },
  async exhaust(id: string, now: Date) {
    await db.webhookDelivery.updateMany({
      where: {
        id,
        status: { in: ["PENDING", "RETRYABLE_FAILURE", "DELIVERING"] },
        attemptCount: { gte: WEBHOOK_POLICY.maxAttempts },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: {
        status: "FAILED",
        lastError: "attempts_exhausted",
        lockToken: null,
        lockedUntil: null,
      },
    });
  },
};

export type WebhookStore = typeof webhookStore;
