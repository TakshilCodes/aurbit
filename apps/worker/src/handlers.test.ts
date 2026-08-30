import { beforeEach, expect, it, vi } from "vitest";
import type { ReportCreatedEvent } from "@aurbit/async-events";
const mocks = vi.hoisted(() => ({ email: vi.fn(), webhooks: vi.fn() }));
vi.mock("./report-created-notification", () => ({
  handleReportCreatedNotification: mocks.email,
}));
vi.mock("./webhooks", () => ({ deliverReportWebhooks: mocks.webhooks }));
vi.mock("./email-delivery-store", () => ({ emailDeliveryStore: {} }));
vi.mock("./email", () => ({ createResendEmailSender: vi.fn() }));
import { createDefaultEventHandlers } from "./handlers";
import {
  PermanentEventProcessingError,
  RetryableEventProcessingError,
} from "./event-errors";
const event: ReportCreatedEvent = {
  type: "report.created",
  eventId: "77d8bc7b-f20c-42c3-905a-a6f3211502d7",
  occurredAt: "2026-08-30T00:00:00Z",
  reportId: "report_1",
  version: 1,
};
const environment = {
  AUTH_RESEND_KEY: "test",
  AUTH_EMAIL_FROM: "test@example.com",
  AUTH_URL: "https://admin.example.com",
};
beforeEach(() => {
  vi.resetAllMocks();
});
it("runs both effects; email failure cannot suppress webhook delivery", async () => {
  mocks.email.mockRejectedValue(
    new RetryableEventProcessingError("email_retry"),
  );
  await expect(
    createDefaultEventHandlers(environment).reportCreated(event),
  ).rejects.toMatchObject({ code: "email_retry" });
  expect(mocks.webhooks).toHaveBeenCalledWith(event, environment);
});
it("retryable webhook failure takes priority over permanent email failure", async () => {
  mocks.email.mockRejectedValue(new PermanentEventProcessingError("permanent"));
  mocks.webhooks.mockRejectedValue(
    new RetryableEventProcessingError("webhook_retry"),
  );
  await expect(
    createDefaultEventHandlers(environment).reportCreated(event),
  ).rejects.toMatchObject({ code: "webhook_retry" });
});
it("updated/resolved are webhook-only", async () => {
  const handlers = createDefaultEventHandlers(environment);
  await handlers.reportUpdated({ ...event, type: "report.updated" });
  await handlers.reportResolved({ ...event, type: "report.resolved" });
  expect(mocks.webhooks).toHaveBeenCalledTimes(2);
  expect(mocks.email).not.toHaveBeenCalled();
});
