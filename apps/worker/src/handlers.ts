import type { EventHandlers } from "./consumer";
import { emailDeliveryStore } from "./email-delivery-store";
import { createResendEmailSender } from "./email";
import {
  requireWorkerEmailEnvironment,
  type WorkerBindings,
} from "./environment";
import { PermanentEventProcessingError } from "./event-errors";
import { deliverReportWebhooks } from "./webhooks";
import { handleReportCreatedNotification } from "./report-created-notification";

export function createDefaultEventHandlers(
  environment: WorkerBindings,
): EventHandlers {
  return {
    async reportCreated(event) {
      const outcomes = await Promise.allSettled([
        Promise.resolve().then(() => {
          const emailEnvironment = requireWorkerEmailEnvironment(environment);
          return handleReportCreatedNotification(event, {
            adminAppUrl: emailEnvironment.AUTH_URL,
            deliveryStore: emailDeliveryStore,
            emailSender: createResendEmailSender({
              apiKey: emailEnvironment.AUTH_RESEND_KEY,
              from: emailEnvironment.AUTH_EMAIL_FROM,
            }),
          });
        }),
        deliverReportWebhooks(event, environment),
      ]);
      // Both side effects run even if either fails. Retryable errors take precedence.
      const failures = outcomes.filter(
        (result) => result.status === "rejected",
      );
      const retryable = failures.find(
        (result) => !(result.reason instanceof PermanentEventProcessingError),
      );
      if (retryable) throw retryable.reason;
      if (failures[0]) throw failures[0].reason;
    },
    reportResolved(event) {
      return deliverReportWebhooks(event, environment);
    },
    reportUpdated(event) {
      return deliverReportWebhooks(event, environment);
    },
  };
}
