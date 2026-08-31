import * as Sentry from "@sentry/cloudflare";
import {
  captureSafely,
  sanitizeSentryEvent,
  sentryDsn,
} from "@aurbit/logger/sentry";
import { runtimeEnvironment, type LogFields } from "@aurbit/logger";
import type { WorkerBindings } from "./environment";

export function workerSentryOptions(environment: WorkerBindings) {
  return {
    dsn: sentryDsn(environment.SENTRY_DSN),
    enabled: !!sentryDsn(environment.SENTRY_DSN),
    environment: runtimeEnvironment(environment.AURBIT_ENV),
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    enableLogs: false,
    tracesSampleRate: 0,
    beforeSend: sanitizeSentryEvent,
  };
}

export function captureUnexpectedError(error: unknown, fields: LogFields) {
  captureSafely(Sentry.captureException, error, fields);
}

export function setScheduledRunId(id: string) {
  try {
    Sentry.setTag("scheduledRunId", id);
  } catch {
    /* Optional telemetry. */
  }
}
