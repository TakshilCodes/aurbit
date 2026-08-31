"use client";

import * as Sentry from "@sentry/nextjs";
import { captureSafely } from "@aurbit/logger/sentry";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Server errors are already captured by onRequestError; avoid a client duplicate.
    if (!error.digest) captureSafely(Sentry.captureException, error, {});
  }, [error]);
  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
