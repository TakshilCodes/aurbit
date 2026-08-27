const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_TOKEN_LENGTH = 2_048;

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  metadata?: {
    result_with_testing_key?: boolean;
  };
};

export type TurnstileVerificationInput = {
  action: string;
  expectedHostname: string;
  remoteIp?: string;
  secretKey: string;
  token: FormDataEntryValue | null;
};

export function isTurnstileTokenValidShape(
  token: FormDataEntryValue | null,
): token is string {
  return (
    typeof token === "string" &&
    token.length > 0 &&
    token.length <= MAX_TOKEN_LENGTH
  );
}

export async function verifyTurnstileToken(
  input: TurnstileVerificationInput,
  fetchImplementation: typeof fetch = fetch,
) {
  if (!isTurnstileTokenValidShape(input.token)) {
    return false;
  }

  const formData = new FormData();
  formData.set("secret", input.secretKey);
  formData.set("response", input.token);
  if (input.remoteIp && input.remoteIp !== "unknown") {
    formData.set("remoteip", input.remoteIp);
  }
  formData.set("idempotency_key", crypto.randomUUID());

  const response = await fetchImplementation(SITEVERIFY_URL, {
    method: "POST",
    body: formData,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error("Turnstile verification request failed");
  }

  const result = (await response.json()) as TurnstileResponse;

  if (result.metadata?.result_with_testing_key === true) {
    return (
      result.success === true &&
      (input.expectedHostname === "localhost" ||
        input.expectedHostname === "127.0.0.1")
    );
  }

  return (
    result.success === true &&
    result.action === input.action &&
    result.hostname === input.expectedHostname
  );
}
