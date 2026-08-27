import type { RateLimitStore } from "@aurbit/rate-limit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_RATE_LIMITS,
  checkAuthRateLimit,
  protectAuthRequest,
  runProtectedAuthOperation,
  verifyTurnstileToken,
} from "./auth-protection";

const baseInput = {
  flow: "login" as const,
  ip: "203.0.113.8",
  email: "user@example.com",
  turnstileToken: "valid-token",
};

describe("authentication abuse protection", () => {
  beforeEach(() => {
    process.env.AUTH_URL = "https://admin.aurbit.takshil.in";
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("permits a normal request after both protections pass", async () => {
    const operation = vi.fn(() => Promise.resolve("completed"));
    const result = await runProtectedAuthOperation(baseInput, operation, {
      rateLimit: vi.fn(() => Promise.resolve(true)),
      verifyTurnstile: vi.fn(() => Promise.resolve(true)),
    });

    expect(result).toEqual({ allowed: true, value: "completed" });
    expect(operation).toHaveBeenCalledOnce();
  });

  it("blocks an invalid Turnstile token without executing the operation", async () => {
    const operation = vi.fn(() => Promise.resolve("completed"));
    const result = await runProtectedAuthOperation(baseInput, operation, {
      rateLimit: vi.fn(() => Promise.resolve(true)),
      verifyTurnstile: vi.fn(() => Promise.resolve(false)),
    });

    expect(result).toEqual({
      allowed: false,
      reason: "turnstile-invalid",
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("blocks a missing Turnstile token without calling Siteverify", async () => {
    const siteverify = vi.fn<typeof fetch>();
    const valid = await verifyTurnstileToken(
      { ...baseInput, turnstileToken: null },
      siteverify,
    );

    expect(valid).toBe(false);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it("validates token action and hostname through Siteverify", async () => {
    const siteverify = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          action: "login",
          hostname: "admin.aurbit.takshil.in",
        }),
        { status: 200 },
      ),
    );

    await expect(verifyTurnstileToken(baseInput, siteverify)).resolves.toBe(
      true,
    );
    expect(siteverify).toHaveBeenCalledOnce();
    const request = siteverify.mock.calls[0]?.[1];
    const body = request?.body as FormData;
    expect(body.get("response")).toBe("valid-token");
    expect(body.get("remoteip")).toBe("203.0.113.8");
    expect(body.get("secret")).toBe("turnstile-secret");
  });

  it("permits Cloudflare testing-key responses only for local development", async () => {
    const siteverify = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "example.com",
          metadata: { result_with_testing_key: true },
        }),
        { status: 200 },
      ),
    );
    process.env.AUTH_URL = "http://localhost:3001";

    await expect(verifyTurnstileToken(baseInput, siteverify)).resolves.toBe(
      true,
    );
  });

  it("does not permit testing-key responses for a deployed hostname", async () => {
    const siteverify = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "example.com",
          metadata: { result_with_testing_key: true },
        }),
        { status: 200 },
      ),
    );

    await expect(verifyTurnstileToken(baseInput, siteverify)).resolves.toBe(
      false,
    );
  });

  it("blocks excessive attempts before calling Turnstile or the operation", async () => {
    const verifyTurnstile = vi.fn(() => Promise.resolve(true));
    const operation = vi.fn(() => Promise.resolve("completed"));
    const result = await runProtectedAuthOperation(baseInput, operation, {
      rateLimit: vi.fn(() => Promise.resolve(false)),
      verifyTurnstile,
    });

    expect(result).toEqual({ allowed: false, reason: "rate-limited" });
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it("uses the configured limit and hashes IP/email key material", async () => {
    const incrementFixedWindow = vi.fn<RateLimitStore["incrementFixedWindow"]>(
      () => Promise.resolve({ count: 10, ttlSeconds: 600 }),
    );
    const store: RateLimitStore = { incrementFixedWindow };

    await expect(checkAuthRateLimit(baseInput, store)).resolves.toBe(true);
    const [key, windowSeconds] = incrementFixedWindow.mock.calls[0] ?? [];

    expect(windowSeconds).toBe(AUTH_RATE_LIMITS.login.windowSeconds);
    expect(key).toMatch(/^aurbit:auth:login:[a-f0-9]{64}$/);
    expect(key).not.toContain(baseInput.ip);
    expect(key).not.toContain(baseInput.email);
  });

  it("fails closed when a protection provider is unavailable", async () => {
    const result = await protectAuthRequest(baseInput, {
      rateLimit: vi.fn(() => Promise.reject(new Error("network unavailable"))),
    });

    expect(result).toEqual({ allowed: false, reason: "unavailable" });
  });
});
