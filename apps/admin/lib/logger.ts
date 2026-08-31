import { createLogger, runtimeEnvironment } from "@aurbit/logger";
import { requestIdFromHeaders } from "@aurbit/logger/request";
import { createBackgroundLogSink } from "@aurbit/logger/better-stack";
import { after } from "next/server";
import { headers } from "next/headers";

const options = {
  service: "aurbit-admin" as const,
  environment: () =>
    runtimeEnvironment(process.env.NEXT_PUBLIC_APP_ENV, process.env.NODE_ENV),
};

function requestSink() {
  return createBackgroundLogSink(
    {
      host: process.env.BETTER_STACK_INGESTING_HOST,
      token: process.env.BETTER_STACK_SOURCE_TOKEN,
    },
    (flush) => after(flush),
  );
}

// Unscoped boundary logs get independent background sends, never a global buffer.
export const logger = createLogger({
  ...options,
  sink: (record) => requestSink()(record),
});

export async function getRequestId() {
  try {
    return requestIdFromHeaders(await headers());
  } catch {
    return crypto.randomUUID();
  } // Unit tests/build-time code have no HTTP context.
}

export async function getRequestLogger() {
  return createLogger(
    { ...options, sink: requestSink() },
    {
      requestId: await getRequestId(),
    },
  );
}
