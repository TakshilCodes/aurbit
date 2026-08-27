const REQUEST_TIMEOUT_MS = 5_000;

const FIXED_WINDOW_INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {current, ttl}
`;

export type RateLimitStore = {
  incrementFixedWindow(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }>;
};

export type RateLimitEnvironment = {
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
};

type RedisClient = {
  eval(
    script: string,
    options: { arguments: string[]; keys: string[] },
  ): Promise<unknown>;
};

type RedisClientFactory = (url: string) => Promise<RedisClient>;

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitConfigurationError";
  }
}

function configuredValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseIncrementResult(result: unknown) {
  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Rate limit store returned an invalid response");
  }

  const count = Number(result[0]);
  const ttlSeconds = Number(result[1]);

  if (!Number.isFinite(count) || !Number.isFinite(ttlSeconds)) {
    throw new Error("Rate limit store returned an invalid response");
  }

  return { count, ttlSeconds };
}

async function createNodeRedisClient(url: string): Promise<RedisClient> {
  const { createClient } = await import("@redis/client");
  const client = createClient({ url });

  // node-redis requires an error listener. Command failures still reject.
  client.on("error", () => undefined);
  await client.connect();

  return client;
}

export class RedisUrlRateLimitStore implements RateLimitStore {
  private clientPromise?: Promise<RedisClient>;

  constructor(
    private readonly url: string,
    private readonly createClient: RedisClientFactory = createNodeRedisClient,
  ) {}

  async incrementFixedWindow(key: string, windowSeconds: number) {
    this.clientPromise ??= this.createClient(this.url).catch(
      (error: unknown) => {
        this.clientPromise = undefined;
        throw error;
      },
    );
    const client = await this.clientPromise;
    const result = await client.eval(FIXED_WINDOW_INCREMENT_SCRIPT, {
      keys: [key],
      arguments: [String(windowSeconds)],
    });

    return parseIncrementResult(result);
  }
}

export class UpstashRestRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async incrementFixedWindow(key: string, windowSeconds: number) {
    const response = await this.fetchImplementation(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        FIXED_WINDOW_INCREMENT_SCRIPT,
        "1",
        key,
        String(windowSeconds),
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error("Upstash rate limit request failed");
    }

    const payload = (await response.json()) as {
      error?: string;
      result?: unknown;
    };

    if (payload.error) {
      throw new Error("Upstash rate limit command failed");
    }

    return parseIncrementResult(payload.result);
  }
}

type RateLimitStoreFactoryDependencies = {
  createRedisUrlStore?: (url: string) => RateLimitStore;
  createUpstashRestStore?: (url: string, token: string) => RateLimitStore;
};

export function createRateLimitStore(
  environment: RateLimitEnvironment,
  dependencies: RateLimitStoreFactoryDependencies = {},
): RateLimitStore {
  const upstashUrl = configuredValue(environment.UPSTASH_REDIS_REST_URL);
  const upstashToken = configuredValue(environment.UPSTASH_REDIS_REST_TOKEN);

  if (upstashUrl || upstashToken) {
    if (!upstashUrl || !upstashToken) {
      throw new RateLimitConfigurationError(
        "Upstash rate limiting requires both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
    }

    return dependencies.createUpstashRestStore
      ? dependencies.createUpstashRestStore(
          upstashUrl.replace(/\/$/, ""),
          upstashToken,
        )
      : new UpstashRestRateLimitStore(
          upstashUrl.replace(/\/$/, ""),
          upstashToken,
        );
  }

  const redisUrl = configuredValue(environment.REDIS_URL);

  if (redisUrl) {
    return dependencies.createRedisUrlStore
      ? dependencies.createRedisUrlStore(redisUrl)
      : new RedisUrlRateLimitStore(redisUrl);
  }

  throw new RateLimitConfigurationError(
    "Rate limiting is not configured. Set Upstash REST credentials or REDIS_URL.",
  );
}

const globalRateLimitStore = globalThis as typeof globalThis & {
  __aurbitRateLimitStore?: RateLimitStore;
};

export function getRateLimitStore() {
  globalRateLimitStore.__aurbitRateLimitStore ??= createRateLimitStore({
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  });
  return globalRateLimitStore.__aurbitRateLimitStore;
}

export async function checkRateLimit(
  input: { key: string; limit: number; windowSeconds: number },
  store: RateLimitStore = getRateLimitStore(),
) {
  const result = await store.incrementFixedWindow(
    input.key,
    input.windowSeconds,
  );

  return result.count <= input.limit;
}
