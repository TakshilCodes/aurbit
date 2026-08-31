import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { after } from "next/server";
import { logger, getRequestLogger } from "./logger";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve(
      new Headers({
        "x-request-id": "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      }),
    ),
  ),
}));
const request = vi.fn<typeof fetch>();
function requestBody(index = 0) {
  const body = request.mock.calls[index]?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected serialized JSON");
  return body;
}
beforeEach(() => {
  vi.mocked(after).mockReset();
  vi.stubEnv("BETTER_STACK_INGESTING_HOST", "test.betterstackdata.com");
  vi.stubEnv("BETTER_STACK_SOURCE_TOKEN", "test-token");
  vi.stubGlobal(
    "fetch",
    request.mockReset().mockResolvedValue(new Response(null, { status: 202 })),
  );
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function runAfter(index = 0) {
  const callback = vi.mocked(after).mock.calls[index]![0];
  if (typeof callback !== "function")
    throw new Error("Expected a deferred callback");
  await callback();
}

it("batches request logger records after response and preserves app/request identity", async () => {
  const scoped = await getRequestLogger();
  scoped.info("report_created", { reportId: "report_1" });
  scoped.info("async_event_enqueued", { eventId: "event_1" });
  expect(request).not.toHaveBeenCalled();
  expect(after).toHaveBeenCalledOnce();
  await runAfter();
  expect(request).toHaveBeenCalledOnce();
  const body = requestBody();
  expect(JSON.parse(body)).toHaveLength(2);
  expect(body).toContain("aurbit-web");
  expect(body).toContain("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
  expect(body).toContain("event_1");
});

it("keeps separately created operation loggers in separate batches", async () => {
  const first = await getRequestLogger();
  const second = await getRequestLogger();
  first.info("report_created", { reportId: "report_a" });
  second.info("report_created", { reportId: "report_b" });
  await runAfter(0);
  await runAfter(1);
  expect(requestBody(0)).not.toContain("report_b");
  expect(requestBody(1)).not.toContain("report_a");
});

it("also exports unscoped boundary logs via after, not immediately", async () => {
  logger.info("report_created");
  expect(request).not.toHaveBeenCalled();
  await runAfter();
  expect(request).toHaveBeenCalledOnce();
});

it("without credentials keeps local stdout and does not schedule network work", () => {
  vi.stubEnv("BETTER_STACK_INGESTING_HOST", "");
  vi.stubEnv("BETTER_STACK_SOURCE_TOKEN", "");
  logger.info("report_created");
  expect(console.info).toHaveBeenCalledOnce();
  expect(after).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it("unavailable Next lifecycle does not fall back to unawaited HTTP calls", () => {
  vi.mocked(after).mockImplementationOnce(() => {
    throw new Error("No request");
  });
  expect(() => logger.info("report_created")).not.toThrow();
  expect(request).not.toHaveBeenCalled();
});
