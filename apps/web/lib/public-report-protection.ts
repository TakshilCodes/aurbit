import {
  checkRateLimit,
  getRateLimitStore,
  type RateLimitStore,
} from "@aurbit/rate-limit";
import {
  isTurnstileTokenValidShape,
  verifyTurnstileToken,
} from "@aurbit/turnstile/server";
import { headers } from "next/headers";
import { getRequestLogger } from "./logger";
import { reportUnexpectedError } from "./observability";

const TURNSTILE_ACTION = "public-report";

export const PUBLIC_REPORT_RATE_LIMIT = {
  attempts: 5,
  windowSeconds: 10 * 60,
} as const;

export type PublicReportProtectionInput = {
  ip: string;
  projectKey: string;
  turnstileToken: FormDataEntryValue | null;
};

export type PublicReportProtectionFailure =
  | "rate-limited"
  | "turnstile-invalid"
  | "unavailable";

type PublicReportProtectionDependencies = {
  rateLimit?: (input: PublicReportProtectionInput) => Promise<boolean>;
  verifyTurnstile?: (input: PublicReportProtectionInput) => Promise<boolean>;
};

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required public report protection setting: ${name}`,
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

export async function getPublicReportClientIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0];

  return (
    requestHeaders.get("cf-connecting-ip")?.trim() ||
    forwardedFor?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 64);
}

export async function checkPublicReportRateLimit(
  input: PublicReportProtectionInput,
  store: RateLimitStore = getRateLimitStore(),
) {
  const identifier = await hashIdentifier(`${input.projectKey}\n${input.ip}`);

  return checkRateLimit(
    {
      key: `aurbit:public-report:${identifier}`,
      limit: PUBLIC_REPORT_RATE_LIMIT.attempts,
      windowSeconds: PUBLIC_REPORT_RATE_LIMIT.windowSeconds,
    },
    store,
  );
}

export async function verifyPublicReportTurnstile(
  input: PublicReportProtectionInput,
  fetchImplementation: typeof fetch = fetch,
) {
  if (!isTurnstileTokenValidShape(input.turnstileToken)) {
    return false;
  }

  const publicAppUrl = requiredEnvironmentValue("PUBLIC_APP_URL");

  return verifyTurnstileToken(
    {
      action: TURNSTILE_ACTION,
      expectedHostname: new URL(publicAppUrl).hostname,
      remoteIp: input.ip,
      secretKey: requiredEnvironmentValue("TURNSTILE_SECRET_KEY"),
      token: input.turnstileToken,
    },
    fetchImplementation,
  );
}

export async function protectPublicReportRequest(
  input: PublicReportProtectionInput,
  dependencies: PublicReportProtectionDependencies = {},
): Promise<
  { allowed: true } | { allowed: false; reason: PublicReportProtectionFailure }
> {
  let stage = "rate_limit";
  try {
    const withinLimit = await (
      dependencies.rateLimit ?? checkPublicReportRateLimit
    )(input);

    if (!withinLimit) {
      (await getRequestLogger()).warn("public_report_protection_rejected", {
        reason: "rate-limited",
      });
      return { allowed: false, reason: "rate-limited" };
    }

    stage = "turnstile";
    const turnstileValid = await (
      dependencies.verifyTurnstile ?? verifyPublicReportTurnstile
    )(input);

    if (!turnstileValid)
      (await getRequestLogger()).warn("public_report_protection_rejected", {
        reason: "turnstile-invalid",
      });
    return turnstileValid
      ? { allowed: true }
      : { allowed: false, reason: "turnstile-invalid" };
  } catch (error) {
    await reportUnexpectedError("public_report_protection_unavailable", error, {
      stage,
    });
    return { allowed: false, reason: "unavailable" };
  }
}
