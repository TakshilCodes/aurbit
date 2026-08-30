-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE', 'SENT');

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "notification_type" VARCHAR(100) NOT NULL,
    "provider_message_id" VARCHAR(100),
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "last_error_code" VARCHAR(64),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_event_id_notification_type_recipient_key" ON "email_deliveries"("event_id", "notification_type", "recipient");

-- CreateIndex
CREATE INDEX "email_deliveries_status_updated_at_idx" ON "email_deliveries"("status", "updated_at");
