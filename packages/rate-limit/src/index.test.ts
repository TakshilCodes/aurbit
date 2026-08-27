import { describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  createRateLimitStore,
  RateLimitConfigurationError,
  RedisUrlRateLimitStore,
  UpstashRestRateLimitStore,
  type RateLimitStore,
} from "./index";

describe("rate limit store selection", () => {
  it("prefers complete Upstash credentials when both backends are configured", () => {
    const upstashStore = { incrementFixedWindow: vi.fn() };
    const redisStore = { incrementFixedWindow: vi.fn() };
    const createUpstashRestStore = vi.fn(() => upstashStore);
    const createRedisUrlStore = vi.fn(() => redisStore);

    const selected = createRateLimitStore(
      {
        REDIS_URL: "redis://localhost:6379",
        UPSTASH_REDIS_REST_TOKEN: "token",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io/",
      },
      { createRedisUrlStore, createUpstashRestStore },
    );

    expect(selected).toBe(upstashStore);
    expect(createUpstashRestStore).toHaveBeenCalledWith(
      "https://example.upstash.io",
      "token",
    );
    expect(createRedisUrlStore).not.toHaveBeenCalled();
  });

  it("selects REDIS_URL when Upstash is not configured", () => {
    const redisStore = { incrementFixedWindow: vi.fn() };
    const createRedisUrlStore = vi.fn(() => redisStore);

    const selected = createRateLimitStore(
      { REDIS_URL: "redis://localhost:6379" },
      { createRedisUrlStore },
    );

    expect(selected).toBe(redisStore);
    expect(createRedisUrlStore).toHaveBeenCalledWith("redis://localhost:6379");
  });

  it("rejects partial Upstash configuration instead of falling back", () => {
    expect(() =>
      createRateLimitStore({
        REDIS_URL: "redis://localhost:6379",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      }),
    ).toThrowError(
      new RateLimitConfigurationError(
        "Upstash rate limiting requires both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      ),
    );
  });

  it("fails clearly when neither backend is configured", () => {
    expect(() => createRateLimitStore({})).toThrowError(
      new RateLimitConfigurationError(
        "Rate limiting is not configured. Set Upstash REST credentials or REDIS_URL.",
      ),
    );
  });
});

describe("rate limit stores", () => {
  it("preserves the Upstash EVAL command contract", async () => {
    const upstash = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ result: [3, 600] }), { status: 200 }),
      );
    const store = new UpstashRestRateLimitStore(
      "https://example.upstash.io",
      "token",
      upstash,
    );

    await expect(store.incrementFixedWindow("test:key", 600)).resolves.toEqual({
      count: 3,
      ttlSeconds: 600,
    });
    const [url, request] = upstash.mock.calls[0] ?? [];
    expect(url).toBe("https://example.upstash.io");
    expect(typeof request?.body).toBe("string");
    const command = JSON.parse(request?.body as string) as unknown[];
    expect(command[0]).toBe("EVAL");
    expect(command[3]).toBe("test:key");
    expect(command[4]).toBe("600");
  });

  it("reuses one local Redis client and the shared fixed-window script", async () => {
    const evalCommand = vi
      .fn()
      .mockResolvedValueOnce([1, 600])
      .mockResolvedValueOnce([2, 599]);
    const createClient = vi.fn(() => Promise.resolve({ eval: evalCommand }));
    const store = new RedisUrlRateLimitStore(
      "redis://localhost:6379",
      createClient,
    );

    await expect(store.incrementFixedWindow("test:key", 600)).resolves.toEqual({
      count: 1,
      ttlSeconds: 600,
    });
    await expect(store.incrementFixedWindow("test:key", 600)).resolves.toEqual({
      count: 2,
      ttlSeconds: 599,
    });
    expect(createClient).toHaveBeenCalledOnce();
    expect(evalCommand).toHaveBeenCalledTimes(2);
    expect(evalCommand.mock.calls[0]?.[1]).toEqual({
      arguments: ["600"],
      keys: ["test:key"],
    });
  });

  it("applies the limit independently of the selected store", async () => {
    const store: RateLimitStore = {
      incrementFixedWindow: vi.fn(() =>
        Promise.resolve({ count: 4, ttlSeconds: 100 }),
      ),
    };

    await expect(
      checkRateLimit({ key: "test:key", limit: 3, windowSeconds: 900 }, store),
    ).resolves.toBe(false);
  });
});
