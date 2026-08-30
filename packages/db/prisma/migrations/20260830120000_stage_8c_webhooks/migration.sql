CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERING', 'RETRYABLE_FAILURE', 'DELIVERED', 'FAILED', 'SKIPPED');

CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_endpoint_id" TEXT NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "response_status" INTEGER,
    "last_error" VARCHAR(64),
    "delivered_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "lock_token" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_endpoints_organization_id_enabled_idx" ON "webhook_endpoints"("organization_id", "enabled");
CREATE INDEX "webhook_deliveries_webhook_endpoint_id_created_at_idx" ON "webhook_deliveries"("webhook_endpoint_id", "created_at");
CREATE UNIQUE INDEX "webhook_deliveries_webhook_endpoint_id_event_id_key" ON "webhook_deliveries"("webhook_endpoint_id", "event_id");
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_fkey" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
