import type { AurbitEvent } from "@aurbit/async-events";
import { WEBHOOK_POLICY } from "@aurbit/webhooks";
import type { WorkerBindings } from "./environment";
import {
  PermanentEventProcessingError,
  RetryableEventProcessingError,
} from "./event-errors";
import { structuredLog } from "./logger";
import { sendWebhook } from "./webhook-request";
import { webhookStore, type WebhookStore } from "./webhook-store";

export async function deliverReportWebhooks(
  event: AurbitEvent,
  environment: WorkerBindings,
  dependencies: { store: WebhookStore; send: typeof sendWebhook } = {
    store: webhookStore,
    send: sendWebhook,
  },
) {
  const { store } = dependencies;
  const report = await store.report(event.reportId);
  if (!report) throw new PermanentEventProcessingError("report_not_found");
  await store.skipInactive(report.organizationId, event.eventId, event.type);
  const endpoints = await store.endpoints(
    report.organizationId,
    event.type,
    event.occurredAt,
  );
  const payload = JSON.stringify({
    id: event.eventId,
    type: event.type,
    version: 1,
    createdAt: event.occurredAt,
    data: {
      reportId: report.id,
      projectKey: report.project.publicKey,
      title: report.title,
      status: report.status,
      priority: report.priority,
    },
  });
  let retry = false;
  for (const endpoint of endpoints) {
    try {
      const delivery = await store.delivery(
        endpoint.id,
        event.eventId,
        event.type,
        payload,
      );
      if (["DELIVERED", "FAILED", "SKIPPED"].includes(delivery.status))
        continue;
      const now = new Date();
      if (delivery.attemptCount >= WEBHOOK_POLICY.maxAttempts) {
        await store.exhaust(delivery.id, now);
        retry = true;
        continue;
      }
      const lockToken = crypto.randomUUID();
      if (!(await store.claim(delivery.id, lockToken, now))) {
        retry = true;
        continue;
      }
      const current = await store.endpoint(endpoint.id, report.organizationId);
      if (
        !current ||
        !current.enabled ||
        !current.events.includes(event.type)
      ) {
        // Deletion cascades delivery rows, so there is nothing left to update in that case.
        if (current)
          await store.finish(delivery.id, lockToken, {
            status: "SKIPPED",
            lastError: "endpoint_disabled",
          });
        continue;
      }
      const attempt = delivery.attemptCount + 1;
      let result;
      try {
        result = await dependencies.send({
          url: current.url,
          secretEncrypted: current.secretEncrypted,
          encryptionKey: environment.WEBHOOK_ENCRYPTION_KEY,
          context: `${report.organizationId}:${current.id}`,
          eventId: event.eventId,
          eventType: event.type,
          body: delivery.payload,
          allowLocal:
            environment.AURBIT_ENV === "local" &&
            environment.WEBHOOK_LOCAL_TESTING === "true",
        });
      } catch {
        result = {
          status: null,
          retryable: true,
          error: "delivery_configuration_error",
        };
      }
      await store.finish(delivery.id, lockToken, {
        status: !result.error
          ? "DELIVERED"
          : result.retryable && attempt < WEBHOOK_POLICY.maxAttempts
            ? "RETRYABLE_FAILURE"
            : "FAILED",
        responseStatus: result.status,
        lastError: result.error,
        deliveredAt: !result.error ? new Date() : null,
      });
      structuredLog(
        result.error ? "warn" : "info",
        "webhook_delivery_completed",
        {
          eventId: event.eventId,
          eventType: event.type,
          endpointId: endpoint.id,
          deliveryId: delivery.id,
          attempt,
          responseStatus: result.status,
          durationMs: Date.now() - now.getTime(),
          retryable: result.retryable,
        },
      );
      if (result.retryable) retry = true;
    } catch {
      retry = true;
      structuredLog("error", "webhook_delivery_processing_failed", {
        eventId: event.eventId,
        eventType: event.type,
        endpointId: endpoint.id,
      });
    }
  }
  if (retry) throw new RetryableEventProcessingError("webhook_delivery_retry");
}
