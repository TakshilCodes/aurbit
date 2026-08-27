import type { RateLimitStore } from "@aurbit/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkPublicReportRateLimit,
  protectPublicReportRequest,
  PUBLIC_REPORT_RATE_LIMIT,
  verifyPublicReportTurnstile,
} from "./public-report-protection";

const baseInput = {
  ip: "203.0.113.8",
  projectKey: "pk_proj_0123456789abcdef01234567",
  turnstileToken: "valid-token",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUBLIC_APP_URL = "https://aurbit.takshil.in";
  process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
});

describe("public report abuse protection", () => {
  it("allows requests when rate limiting and Turnstile pass", async () => {
    await expect(
      protectPublicReportRequest(baseInput, {
        rateLimit: vi.fn(() => Promise.resolve(true)),
        verifyTurnstile: vi.fn(() => Promise.resolve(true)),
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("blocks excessive attempts before calling Turnstile", async () => {
    const verifyTurnstile = vi.fn(() => Promise.resolve(true));

    await expect(
      protectPublicReportRequest(baseInput, {
        rateLimit: vi.fn(() => Promise.resolve(false)),
        verifyTurnstile,
      }),
    ).resolves.toEqual({ allowed: false, reason: "rate-limited" });
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it("blocks invalid Turnstile tokens", async () => {
    await expect(
      protectPublicReportRequest(baseInput, {
        rateLimit: vi.fn(() => Promise.resolve(true)),
        verifyTurnstile: vi.fn(() => Promise.resolve(false)),
      }),
    ).resolves.toEqual({ allowed: false, reason: "turnstile-invalid" });
  });

  it("fails closed when either protection provider is unavailable", async () => {
    await expect(
      protectPublicReportRequest(baseInput, {
        rateLimit: vi.fn(() => Promise.reject(new Error("Redis unavailable"))),
      }),
    ).resolves.toEqual({ allowed: false, reason: "unavailable" });
  });

  it("uses the shared limiter with a hashed project and IP key", async () => {
    const incrementFixedWindow = vi.fn<RateLimitStore["incrementFixedWindow"]>(
      () => Promise.resolve({ count: 5, ttlSeconds: 600 }),
    );

    await expect(
      checkPublicReportRateLimit(baseInput, { incrementFixedWindow }),
    ).resolves.toBe(true);

    const [key, windowSeconds] = incrementFixedWindow.mock.calls[0] ?? [];
    expect(key).toMatch(/^aurbit:public-report:[a-f0-9]{64}$/);
    expect(key).not.toContain(baseInput.projectKey);
    expect(key).not.toContain(baseInput.ip);
    expect(windowSeconds).toBe(PUBLIC_REPORT_RATE_LIMIT.windowSeconds);
  });

  it("rejects a missing Turnstile token without calling Siteverify", async () => {
    const siteverify = vi.fn<typeof fetch>();

    await expect(
      verifyPublicReportTurnstile(
        { ...baseInput, turnstileToken: null },
        siteverify,
      ),
    ).resolves.toBe(false);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it("verifies the public-report action and hostname through Siteverify", async () => {
    const siteverify = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          action: "public-report",
          hostname: "aurbit.takshil.in",
          success: true,
        }),
        { status: 200 },
      ),
    );

    await expect(
      verifyPublicReportTurnstile(baseInput, siteverify),
    ).resolves.toBe(true);
  });
});
