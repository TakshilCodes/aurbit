import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptWebhookSecret, signWebhook } from "@aurbit/webhooks/crypto";
import { WebhookConfigurationError } from "@aurbit/webhooks";
import { validateWebhookDestination } from "@aurbit/webhooks/url";
import { sendWebhook } from "./webhook-request";

const secret = "whsec_test";
const key = btoa("k".repeat(32));
const dependencies = {
  request: vi.fn<typeof fetch>(),
  validate: vi.fn<typeof validateWebhookDestination>(),
  now: () => 1700000000000,
};
async function input() {
  return {
    url: "https://example.com/hook",
    secretEncrypted: await encryptWebhookSecret(secret, key, "org:endpoint"),
    encryptionKey: key,
    context: "org:endpoint",
    eventId: "event_1",
    eventType: "report.created",
    body: '{"id":"event_1"}',
    allowLocal: false,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  dependencies.validate.mockResolvedValue("https://example.com/hook");
  dependencies.request.mockResolvedValue(new Response(null, { status: 204 }));
});
describe("signed webhook HTTP requests", () => {
  it("sends required headers, exact body, timeout and no redirects", async () => {
    const data = await input();
    await expect(sendWebhook(data, dependencies)).resolves.toEqual({
      status: 204,
      retryable: false,
      error: null,
    });
    expect(dependencies.request).toHaveBeenCalledWith(
      data.url,
      expect.objectContaining({
        method: "POST",
        body: data.body,
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "Aurbit-Event-Id": data.eventId,
          "Aurbit-Event-Type": data.eventType,
          "Aurbit-Timestamp": "1700000000",
          "Aurbit-Signature": await signWebhook(
            secret,
            "1700000000",
            data.body,
          ),
        },
      }),
    );
    expect(dependencies.request.mock.calls[0]?.[1]?.signal).toBeInstanceOf(
      AbortSignal,
    );
  });
  it.each([408, 425, 429, 500, 503])("retries HTTP %s", async (status) => {
    dependencies.request.mockResolvedValue(new Response(null, { status }));
    expect(await sendWebhook(await input(), dependencies)).toEqual({
      status,
      retryable: true,
      error: "http_error",
    });
  });
  it.each([400, 401, 403, 404, 410, 422, 302])(
    "does not retry permanent HTTP %s",
    async (status) => {
      dependencies.request.mockResolvedValue(new Response(null, { status }));
      expect((await sendWebhook(await input(), dependencies)).retryable).toBe(
        false,
      );
      expect(dependencies.request).toHaveBeenCalledTimes(1);
    },
  );
  it("retries network failures with safe error codes", async () => {
    dependencies.request.mockRejectedValue(
      new Error("sensitive server response"),
    );
    expect(await sendWebhook(await input(), dependencies)).toEqual({
      status: null,
      retryable: true,
      error: "network_error",
    });
  });
  it("blocks private DNS before a customer request", async () => {
    dependencies.validate.mockRejectedValue(
      new WebhookConfigurationError("private"),
    );
    expect((await sendWebhook(await input(), dependencies)).error).toBe(
      "unsafe_destination",
    );
    expect(dependencies.request).not.toHaveBeenCalled();
  });
});
