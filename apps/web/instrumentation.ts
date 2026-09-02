import * as Sentry from "@sentry/nextjs";
import { runtimeEnvironment } from "@aurbit/logger";
import { sentryDsn, sanitizeSentryEvent } from "@aurbit/logger/sentry";
import { cloudflareRayIdFromHeaders } from "@aurbit/logger/request";
import { logger } from "./lib/logger";

export function register() {
  const dsn = sentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: runtimeEnvironment(
        process.env.NEXT_PUBLIC_APP_ENV,
        process.env.NODE_ENV,
      ),
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      enableLogs: false,
      tracesSampleRate: 0,
      beforeSend: sanitizeSentryEvent,
    });
  } catch {
    logger.warn("sentry_initialization_failed");
  }
}

export const onRequestError: typeof Sentry.captureRequestError = (
  error,
  request,
  context,
) => {
  const incomingRayId = request.headers["cf-ray"];
  const requestId =
    cloudflareRayIdFromHeaders(
      new Headers({
        "cf-ray": typeof incomingRayId === "string" ? incomingRayId : "",
      }),
    ) ?? crypto.randomUUID();
  logger.error("http_request_failed", {
    requestId,
    method: request.method,
    error,
  });
  try {
    // The SDK manages flushing. Never pass raw headers, query strings or bodies.
    Sentry.withScope((scope) => {
      scope.setTag("requestId", requestId);
      Sentry.captureRequestError(
        error,
        { ...request, path: "/", headers: { "cf-ray": requestId } },
        context,
      );
    });
  } catch {
    /* Optional telemetry must not change the framework response. */
  }
};
