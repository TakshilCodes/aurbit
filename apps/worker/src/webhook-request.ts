import { WebhookConfigurationError, WEBHOOK_POLICY } from "@aurbit/webhooks";
import { decryptWebhookSecret, signWebhook } from "@aurbit/webhooks/crypto";
import { validateWebhookDestination } from "@aurbit/webhooks/url";

export type WebhookRequestResult = {
  status: number | null;
  retryable: boolean;
  error: string | null;
};

export async function sendWebhook(
  input: {
    url: string;
    secretEncrypted: string;
    encryptionKey: string | undefined;
    context: string;
    eventId: string;
    eventType: string;
    body: string;
    allowLocal: boolean;
  },
  dependencies = {
    // Workers fetch requires the global receiver when called as an object method.
    request: fetch.bind(globalThis),
    validate: validateWebhookDestination,
    now: () => Date.now(),
  },
): Promise<WebhookRequestResult> {
  const signal = AbortSignal.timeout(WEBHOOK_POLICY.timeoutMs);
  // Bad encryption configuration is retryable after an operator fixes it, not a bad customer URL.
  const secret = await decryptWebhookSecret(
    input.secretEncrypted,
    input.encryptionKey,
    input.context,
  );
  try {
    const url = await dependencies.validate(
      input.url,
      signal,
      input.allowLocal,
    );
    const timestamp = Math.floor(dependencies.now() / 1000).toString();
    const signature = await signWebhook(secret, timestamp, input.body);
    const response = await dependencies.request(url, {
      method: "POST",
      redirect: "manual",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Aurbit-Event-Id": input.eventId,
        "Aurbit-Event-Type": input.eventType,
        "Aurbit-Timestamp": timestamp,
        "Aurbit-Signature": signature,
      },
      body: input.body,
    });
    // Never retain/log customer response bodies or follow a redirect to another destination.
    await response.body?.cancel();
    if (response.status >= 200 && response.status < 300)
      return { status: response.status, retryable: false, error: null };
    return {
      status: response.status,
      retryable:
        [408, 425, 429].includes(response.status) || response.status >= 500,
      error:
        response.status >= 300 && response.status < 400
          ? "redirect_rejected"
          : "http_error",
    };
  } catch (error) {
    if (error instanceof WebhookConfigurationError)
      return { status: null, retryable: false, error: "unsafe_destination" };
    return {
      status: null,
      retryable: true,
      error: signal.aborted ? "timeout" : "network_error",
    };
  }
}
