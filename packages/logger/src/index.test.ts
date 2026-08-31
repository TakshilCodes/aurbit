import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, runtimeEnvironment, serializeError } from "./index";
import { createRequestContext, requestIdFromHeaders } from "./request";
import { captureSafely, sanitizeSentryEvent, sentryDsn } from "./sentry";

const logger = createLogger({
  service: "aurbit-worker",
  environment: "production",
});
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function info() {
  return JSON.parse(
    vi.mocked(console.info).mock.calls[0]?.[0] as string,
  ) as Record<string, unknown>;
}

describe("operational logging", () => {
  it("includes timestamp, service, environment and immutable base fields", () => {
    logger.info("report_created", {
      reportId: "report_1",
      service: "forged",
      environment: "forged",
      level: "debug",
    });
    expect(info()).toMatchObject({
      service: "aurbit-worker",
      environment: "production",
      level: "info",
      reportId: "report_1",
    });
    expect(info().timestamp).toEqual(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });
  it("keeps event context isolated between child loggers", () => {
    logger
      .child({ eventId: "event_1" })
      .info("async_event_processed", { reportId: "report_1" });
    logger.child({ eventId: "event_2" }).info("async_event_processed");
    expect(info()).toMatchObject({ eventId: "event_1", reportId: "report_1" });
    expect(console.info).toHaveBeenLastCalledWith(
      expect.stringContaining('"eventId":"event_2"'),
    );
  });
  it("disables debug in production but supports it locally", () => {
    logger.debug("debug_event");
    expect(console.debug).not.toHaveBeenCalled();
    createLogger({ service: "aurbit-web", environment: "local" }).debug(
      "debug_event",
    );
    expect(console.debug).toHaveBeenCalledOnce();
  });
  it("drops sensitive, arbitrary and oversized fields rather than traversing payloads", () => {
    const sensitive = {
      password: "secret-password",
      passwordHash: "secret-hash",
      token: "magic-token",
      sessionToken: "session-secret",
      inviteToken: "invite-secret",
      turnstileToken: "challenge-secret",
      UPSTASH_REDIS_REST_TOKEN: "redis-secret",
      AUTH_RESEND_KEY: "resend-secret",
      authorization: "Bearer secret",
      cookies: "session=secret",
      secretEncrypted: "webhook-secret",
      description: "private-report",
      internalNotes: "private-note",
      html: "email-body",
      reporterEmail: "someone@example.com",
      request: new Request("https://example.com/?token=secret"),
      body: new Uint8Array(1024),
      reportId: "x".repeat(10000),
    };
    logger.info("boundary_event", sensitive);
    const line = String(vi.mocked(console.info).mock.calls[0]?.[0]);
    for (const key of Object.keys(sensitive))
      expect(info()).not.toHaveProperty(key);
    expect(line.length).toBeLessThan(300);
  });
  it("never serializes raw error messages, cause, stack, or database query data", () => {
    const error = Object.assign(
      new Error("password=secret and private report text", {
        cause: new Error("secret"),
      }),
      {
        name: "PrismaClientKnownRequestError",
        code: "P2002",
      },
    );
    expect(serializeError(error)).toEqual({
      name: "PrismaClientKnownRequestError",
      code: "P2002",
      message: "PrismaClientKnownRequestError: P2002",
    });
    logger.error("database_failure", { error });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"code":"P2002"'),
    );
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining("secret"),
    );
  });
  it("handles non-errors, cycles, getters and broken sinks without throwing", () => {
    const bad: Record<string, unknown> = {};
    bad.self = bad;
    Object.defineProperty(bad, "reportId", {
      enumerable: true,
      get() {
        throw new Error("getter");
      },
    });
    // Passing the object itself does not evaluate accessors.
    expect(() => logger.error("unexpected_failure", bad)).not.toThrow();
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error("sink unavailable");
    });
    expect(() => logger.info("boundary_event")).not.toThrow();
    expect(serializeError({ password: "secret" })).toMatchObject({
      name: "Error",
    });
  });
  it("needs no Better Stack token, fetch, provider SDK, or network", () => {
    const request = vi.fn(() => {
      throw new Error("network unavailable");
    });
    vi.stubGlobal("fetch", request);
    expect(() => logger.info("local_execution")).not.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("distinguishes local, staging, production and test", () => {
    expect(runtimeEnvironment("staging", "production")).toBe("staging");
    expect(runtimeEnvironment(undefined, "production")).toBe("production");
    expect(runtimeEnvironment(undefined, "development")).toBe("local");
  });
});

describe("HTTP request correlation", () => {
  it("overwrites even a plausible client-provided ID and forwards the generated ID", () => {
    const incoming = new Headers({
      "x-request-id": crypto.randomUUID(),
      cookie: "preserved-for-auth",
    });
    const context = createRequestContext(incoming);
    expect(context.requestId).not.toBe(incoming.get("x-request-id"));
    expect(requestIdFromHeaders(context.headers)).toBe(context.requestId);
    expect(context.headers.get("cookie")).toBe("preserved-for-auth");
    expect(createRequestContext(incoming).requestId).not.toBe(
      context.requestId,
    );
  });
  it("generates an ID when the internal header is absent or invalid", () => {
    for (const value of ["", "secret-cookie-value", "x".repeat(1000)]) {
      expect(
        requestIdFromHeaders(new Headers({ "x-request-id": value })),
      ).toMatch(/^[a-f0-9-]{36}$/);
    }
  });
});

describe("optional Sentry and privacy boundary", () => {
  it("accepts an optional valid DSN and rejects malformed configuration", () => {
    expect(sentryDsn(undefined)).toBeUndefined();
    expect(sentryDsn("not-a-url")).toBeUndefined();
    expect(sentryDsn("https://public@o0.ingest.sentry.io/1")).toBeDefined();
    expect(sentryDsn("https://public:secret@example.com/1")).toBeUndefined();
  });
  it("keeps safe stack locations, strips user/request/body/breadcrumb data and secret URLs", () => {
    const output = sanitizeSentryEvent({
      event_id: "event",
      environment: "staging",
      release: "aurbit@abc123",
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            debug_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
            code_file: "https://example.com/app.js?token=secret",
          },
        ],
      },
      tags: { requestId: "request_1", token: "secret" },
      user: { email: "secret@example.com" },
      request: { cookies: "secret", data: "private-body" },
      extra: { token: "secret" },
      breadcrumbs: [{ message: "private-note" }],
      exception: {
        values: [
          {
            type: "TypeError",
            value: "token=secret",
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://user:secret@example.com/app.js?token=secret",
                  lineno: 12,
                  vars: { secret: "secret" },
                  pre_context: ["secret"],
                },
              ],
            },
          },
        ],
      },
    });
    expect(output).not.toHaveProperty("request");
    expect(output).not.toHaveProperty("user");
    expect(output.release).toBe("aurbit@abc123");
    expect(output.debug_meta?.images).toEqual([
      {
        type: "sourcemap",
        debug_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        code_file: "/app.js",
      },
    ]);
    expect(output.tags).toEqual({ requestId: "request_1" });
    expect(
      output.exception?.values?.[0]?.stacktrace?.frames?.[0],
    ).toMatchObject({ filename: "/app.js", lineno: 12 });
    expect(JSON.stringify(output)).not.toContain("secret");
  });
  it("does not propagate optional exception-export failures", () => {
    const capture = vi.fn(() => {
      throw new Error("provider unavailable");
    });
    expect(() =>
      captureSafely(capture, new Error("failure"), {
        requestId: "request_1",
        authorization: "secret",
      }),
    ).not.toThrow();
    expect(capture).toHaveBeenCalledWith(expect.any(Error), {
      tags: { requestId: "request_1" },
    });
  });
});
