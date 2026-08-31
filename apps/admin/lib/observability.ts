import * as Sentry from "@sentry/nextjs";
import { captureSafely } from "@aurbit/logger/sentry";
import type { LogFields } from "@aurbit/logger";
import { after } from "next/server";
import { getRequestId, logger } from "./logger";

export async function reportUnexpectedError(
  message: string,
  error: unknown,
  fields: LogFields = {},
) {
  const context = { ...fields, requestId: await getRequestId() };
  logger.error(message, { ...context, error });
  captureSafely(Sentry.captureException, error, context);
  try {
    after(async () => {
      try {
        await Sentry.flush(2_000);
      } catch {
        /* Optional export. */
      }
    });
  } catch {
    /* No request lifecycle outside Next (for example, unit tests). */
  }
}
