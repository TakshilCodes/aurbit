import * as Sentry from "@sentry/nextjs";
import { runtimeEnvironment } from "@aurbit/logger";
import { sentryDsn, sanitizeSentryEvent } from "@aurbit/logger/sentry";

const dsn = sentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
if (dsn) {
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
    /* Monitoring is optional, including during local development. */
  }
}
