import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLogger } from "./index";
import {
  createBackgroundLogSink,
  createBetterStackBatch,
} from "./better-stack";

const config = { host: "test.betterstackdata.com", token: "test-source-token" };
const request = vi.fn<typeof fetch>();
const options = { service: "aurbit-web" as const, environment: "test" };
function requestBody() {
  const body = request.mock.calls[0]?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected serialized JSON");
  return body;
}
beforeEach(() => {
  request.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", request);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("batches sanitized records in one authenticated HTTPS request, preserving correlation", async () => {
  const batch = createBetterStackBatch(config);
  const logger = createLogger({ ...options, sink: batch.write }).child({
    requestId: "request_1",
  });
  logger.info("report_created", {
    eventId: "event_1",
    reportId: "report_1",
    password: "secret-password",
    html: "private-body",
  });
  logger.error("report_failed", {
    error: new Error("private-error-secret"),
    token: config.token,
  });
  expect(request).not.toHaveBeenCalled();
  await batch.flush();
  await batch.flush();
  expect(request).toHaveBeenCalledOnce();
  const [url, init] = request.mock.calls[0]!;
  expect(url).toBe("https://test.betterstackdata.com");
  expect(init).toMatchObject({
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-source-token",
    },
  });
  const body = requestBody();
  const records = JSON.parse(body) as Record<string, unknown>[];
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({
    service: "aurbit-web",
    environment: "test",
    requestId: "request_1",
    eventId: "event_1",
    reportId: "report_1",
  });
  expect(records[0]?.dt).toBe(records[0]?.timestamp);
  expect(body).not.toMatch(
    /secret-password|private-body|private-error-secret|test-source-token/,
  );
  expect(records[1]?.error).toMatchObject({
    name: "Error",
    message: "Error: operation failed (details withheld)",
  });
});

it("missing optional configuration keeps stdout without scheduling or networking", async () => {
  const schedule = vi.fn();
  createLogger({
    ...options,
    sink: createBackgroundLogSink({}, schedule),
  }).info("report_created");
  await createBetterStackBatch({}).flush();
  expect(console.info).toHaveBeenCalledOnce();
  expect(schedule).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
});

it.each([
  { host: "http://test.betterstackdata.com", token: "secret" },
  { host: "https://example.com", token: "secret" },
  { host: "https://localhost", token: "secret" },
  { host: "https://user:secret@test.betterstackdata.com", token: "secret" },
  { host: "https://test.betterstackdata.com/?token=secret", token: "secret" },
  { host: "test.betterstackdata.com:8443", token: "secret" },
  { host: "test.betterstackdata.com.evil.example", token: "secret" },
  { host: config.host },
  { token: "secret" },
  { host: config.host, token: "secret\nheader" },
])(
  "rejects unsafe/partial configuration without leaking it: %j",
  async (invalid) => {
    const batch = createBetterStackBatch(invalid);
    const logger = createLogger({ ...options, sink: batch.write });
    logger.info("report_created");
    logger.info("report_created");
    await batch.flush();
    expect(request).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(String(vi.mocked(console.warn).mock.calls[0]?.[0])).not.toContain(
      "secret",
    );
  },
);

it("registers one background callback and sends nothing before it runs", async () => {
  const schedule = vi.fn<(flush: () => Promise<void>) => void>();
  const logger = createLogger({
    ...options,
    sink: createBackgroundLogSink(config, schedule),
  });
  logger.info("report_created");
  logger.info("async_event_enqueued");
  expect(schedule).toHaveBeenCalledOnce();
  expect(request).not.toHaveBeenCalled();
  await schedule.mock.calls[0]![0]();
  expect(request).toHaveBeenCalledOnce();
});

it("does not send unowned network work when the runtime cannot schedule it", () => {
  const sink = createBackgroundLogSink(config, () => {
    throw new Error("no request context");
  });
  expect(() =>
    createLogger({ ...options, sink }).info("report_created"),
  ).not.toThrow();
  expect(request).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("lifecycle_unavailable"),
  );
});

it.each([403, 429, 500])(
  "contains HTTP %i failures without retrying or exposing provider bodies",
  async (status) => {
    request.mockResolvedValueOnce(
      new Response("private-provider-response", { status }),
    );
    const batch = createBetterStackBatch(config);
    createLogger({ ...options, sink: batch.write }).info("report_created");
    await expect(batch.flush()).resolves.toBeUndefined();
    await batch.flush();
    expect(request).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('"responseStatus":' + status),
    );
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("private-provider-response"),
    );
  },
);

it("contains network errors without logging raw exception details", async () => {
  request.mockRejectedValueOnce(new Error("Authorization: Bearer secret"));
  const batch = createBetterStackBatch(config);
  createLogger({ ...options, sink: batch.write }).info("report_created");
  await expect(batch.flush()).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("network_failure"),
  );
  expect(console.warn).not.toHaveBeenCalledWith(
    expect.stringContaining("secret"),
  );
});

it("aborts a slow provider after three seconds", async () => {
  vi.useFakeTimers();
  request.mockImplementationOnce(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      }),
  );
  const batch = createBetterStackBatch(config);
  createLogger({ ...options, sink: batch.write }).info("report_created");
  const pending = batch.flush();
  await vi.advanceTimersByTimeAsync(3_000);
  await expect(pending).resolves.toBeUndefined();
  expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("timeout"));
});

it("caps the batch at 100 records and reports drops once on stdout", async () => {
  const batch = createBetterStackBatch(config);
  const logger = createLogger({ ...options, sink: batch.write });
  for (let i = 0; i < 105; i++) logger.info("report_created");
  await batch.flush();
  expect(JSON.parse(requestBody())).toHaveLength(100);
  expect(console.info).toHaveBeenCalledTimes(105);
  expect(console.warn).toHaveBeenCalledOnce();
});

it("also bounds bytes, even below the record-count limit", async () => {
  const batch = createBetterStackBatch(config);
  const logger = createLogger({ ...options, sink: batch.write });
  const fields = Object.fromEntries(
    [
      "requestId",
      "eventId",
      "reportId",
      "projectId",
      "organizationId",
      "deliveryId",
      "endpointId",
      "userId",
      "memberId",
      "messageId",
    ].map((key) => [key, "x".repeat(160)]),
  );
  for (let i = 0; i < 100; i++) logger.info("report_created", fields);
  await batch.flush();
  const body = requestBody();
  expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(
    128 * 1024,
  );
  expect((JSON.parse(body) as unknown[]).length).toBeLessThan(100);
});

it("a broken optional sink cannot suppress stdout or throw to business code", () => {
  const logger = createLogger({
    ...options,
    sink: () => {
      throw new Error("export broken");
    },
  });
  expect(() => logger.info("report_created")).not.toThrow();
  expect(console.info).toHaveBeenCalledOnce();
});
