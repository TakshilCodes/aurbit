import {
  checkRateLimit,
  getRateLimitStore,
  type RateLimitStore,
} from "@aurbit/rate-limit";
import {
  isTurnstileTokenValidShape,
  verifyTurnstileToken as verifySharedTurnstileToken,
} from "@aurbit/turnstile/server";
import { headers } from "next/headers";

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

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required authentication protection setting: ${name}`,
    );
  }

  return value;
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
  fetchImplementation: typeof fetch = fetch,
) {
  if (!isTurnstileTokenValidShape(input.turnstileToken)) {
    return false;
  }

  const secret = requiredEnvironmentValue("TURNSTILE_SECRET_KEY");
  const authUrl = requiredEnvironmentValue("AUTH_URL");

  return verifySharedTurnstileToken(
    {
      action: input.flow,
      expectedHostname: new URL(authUrl).hostname,
      remoteIp: input.ip,
      secretKey: secret,
      token: input.turnstileToken,
    },
    fetchImplementation,
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
