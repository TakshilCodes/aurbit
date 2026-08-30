import { db, EmailDeliveryStatus } from "@aurbit/db";

export type EmailDeliveryRecord = {
  id: string;
  status: EmailDeliveryStatus;
};

export type EmailDeliveryStore = {
  getOrCreate(input: {
    eventId: string;
    notificationType: string;
    recipient: string;
  }): Promise<EmailDeliveryRecord>;
  markPermanentFailure(id: string, errorCode: string): Promise<void>;
  markRetryableFailure(id: string, errorCode: string): Promise<void>;
  markSent(id: string, providerMessageId: string): Promise<void>;
};

export const emailDeliveryStore: EmailDeliveryStore = {
  getOrCreate(input) {
    return db.emailDelivery.upsert({
      where: {
        eventId_notificationType_recipient: input,
      },
      create: input,
      update: {},
      select: { id: true, status: true },
    });
  },

  async markPermanentFailure(id, errorCode) {
    await db.emailDelivery.updateMany({
      where: { id, status: { not: EmailDeliveryStatus.SENT } },
      data: {
        lastErrorCode: errorCode,
        status: EmailDeliveryStatus.PERMANENT_FAILURE,
      },
    });
  },

  async markRetryableFailure(id, errorCode) {
    await db.emailDelivery.updateMany({
      where: {
        id,
        status: {
          notIn: [
            EmailDeliveryStatus.PERMANENT_FAILURE,
            EmailDeliveryStatus.SENT,
          ],
        },
      },
      data: {
        lastErrorCode: errorCode,
        status: EmailDeliveryStatus.RETRYABLE_FAILURE,
      },
    });
  },

  async markSent(id, providerMessageId) {
    await db.emailDelivery.update({
      where: { id },
      data: {
        lastErrorCode: null,
        providerMessageId,
        sentAt: new Date(),
        status: EmailDeliveryStatus.SENT,
      },
    });
  },
};
