import {
  checkRateLimit,
  getRateLimitStore,
  type RateLimitStore,
} from "@aurbit/rate-limit";
import { headers } from "next/headers";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const REQUEST_TIMEOUT_MS = 5_000;

export const AUTH_RATE_LIMITS = {
  login: { attempts: 10, windowSeconds: 10 * 60 },
  signup: { attempts: 5, windowSeconds: 60 * 60 },
  "magic-link": { attempts: 3, windowSeconds: 15 * 60 },
  "forgot-password": { attempts: 3, windowSeconds: 15 * 60 },
  "resend-verification": { attempts: 3, windowSeconds: 15 * 60 },
} as const;

export type AuthProtectionFlow = keyof typeof AUTH_RATE_LIMITS;
export type AuthProtectionFailure =
  | "rate-limited"
  | "turnstile-invalid"
  | "unavailable";

type Fetch = typeof fetch;

type ProtectionInput = {
  flow: AuthProtectionFlow;
  ip: string;
  email?: string;
  turnstileToken: FormDataEntryValue | null;
};

type ProtectionResult =
  | { allowed: true }
  | { allowed: false; reason: AuthProtectionFailure };

type ProtectionDependencies = {
  rateLimit?: (input: ProtectionInput) => Promise<boolean>;
  verifyTurnstile?: (input: ProtectionInput) => Promise<boolean>;
};

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  metadata?: {
    result_with_testing_key?: boolean;
  };
};

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required authentication protection setting: ${name}`,
    );
  }

  return value;
}

function requestSignal() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

async function hashIdentifier(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function getClientIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0];

  return (
    requestHeaders.get("cf-connecting-ip")?.trim() ||
    forwardedFor?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 64);
}

export async function checkAuthRateLimit(
  input: ProtectionInput,
  store: RateLimitStore = getRateLimitStore(),
) {
  const limit = AUTH_RATE_LIMITS[input.flow];
  const normalizedEmail =
    input.flow === "signup" ? "" : (input.email?.trim().toLowerCase() ?? "");
  const identifier = await hashIdentifier(
    `${input.flow}\n${input.ip}\n${normalizedEmail}`,
  );
  const key = `aurbit:auth:${input.flow}:${identifier}`;

  return checkRateLimit(
    {
      key,
      limit: limit.attempts,
      windowSeconds: limit.windowSeconds,
    },
    store,
  );
}

export async function verifyTurnstileToken(
  input: ProtectionInput,
  fetchImplementation: Fetch = fetch,
) {
  if (
    typeof input.turnstileToken !== "string" ||
    !input.turnstileToken ||
    input.turnstileToken.length > 2_048
  ) {
    return false;
  }

  const secret = requiredEnvironmentValue("TURNSTILE_SECRET_KEY");
  const authUrl = requiredEnvironmentValue("AUTH_URL");
  const expectedHostname = new URL(authUrl).hostname;
  const formData = new FormData();
  formData.set("secret", secret);
  formData.set("response", input.turnstileToken);
  if (input.ip !== "unknown") {
    formData.set("remoteip", input.ip);
  }
  formData.set("idempotency_key", crypto.randomUUID());

  const response = await fetchImplementation(SITEVERIFY_URL, {
    method: "POST",
    body: formData,
    cache: "no-store",
    signal: requestSignal(),
  });

  if (!response.ok) {
    throw new Error("Turnstile verification request failed");
  }

  const result = (await response.json()) as TurnstileResponse;

  if (result.metadata?.result_with_testing_key === true) {
    return (
      result.success === true &&
      (expectedHostname === "localhost" || expectedHostname === "127.0.0.1")
    );
  }

  return (
    result.success === true &&
    result.action === input.flow &&
    result.hostname === expectedHostname
  );
}

export async function protectAuthRequest(
  input: ProtectionInput,
  dependencies: ProtectionDependencies = {},
): Promise<ProtectionResult> {
  try {
    const withinLimit = await (dependencies.rateLimit ?? checkAuthRateLimit)(
      input,
    );

    if (!withinLimit) {
      return { allowed: false, reason: "rate-limited" };
    }

    const turnstileValid = await (
      dependencies.verifyTurnstile ?? verifyTurnstileToken
    )(input);

    return turnstileValid
      ? { allowed: true }
      : { allowed: false, reason: "turnstile-invalid" };
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}

export async function runProtectedAuthOperation<T>(
  input: ProtectionInput,
  operation: () => Promise<T>,
  dependencies: ProtectionDependencies = {},
): Promise<
  | { allowed: true; value: T }
  | { allowed: false; reason: AuthProtectionFailure }
> {
  const protection = await protectAuthRequest(input, dependencies);

  if (!protection.allowed) {
    return protection;
  }

  return { allowed: true, value: await operation() };
}
