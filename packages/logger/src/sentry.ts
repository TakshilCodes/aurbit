import { safeErrorName, sanitizeFields, type LogFields } from "./index";

// Structural types keep the logger independent of any Sentry SDK.
type ErrorEvent = {
  event_id?: string;
  timestamp?: number;
  platform?: string;
  level?: string;
  environment?: string;
  release?: string;
  debug_meta?: {
    images?: Array<{ type: string; debug_id?: string; code_file?: string }>;
  };
  tags?: Record<string, unknown>;
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: {
        frames?: Array<{
          filename?: string;
          lineno?: number;
          colno?: number;
          in_app?: boolean;
        }>;
      };
    }>;
  };
};

export function sentryDsn(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !!url.username &&
      !url.password &&
      /^\/\d+$/.test(url.pathname)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

// Rebuild, rather than redact a few known properties. No request headers/body,
// user, breadcrumbs, query strings, frame locals/source context or extra payloads.
function codeFilename(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const path = value.includes("://")
      ? new URL(value).pathname
      : value.split(/[?#]/)[0];
    return path?.slice(-300);
  } catch {
    return undefined;
  }
}

export function sanitizeSentryEvent<T extends ErrorEvent>(event: T): T {
  return {
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release:
      event.release && /^[\w.@/-]{1,160}$/.test(event.release)
        ? event.release
        : undefined,
    debug_meta: {
      images: event.debug_meta?.images
        ?.filter(
          (image) =>
            image.type === "sourcemap" &&
            /^[a-f0-9-]{36}$/i.test(image.debug_id ?? ""),
        )
        .slice(0, 30)
        .map((image) => ({
          type: "sourcemap",
          debug_id: image.debug_id,
          code_file: codeFilename(image.code_file),
        })),
    },
    tags: safeTags(event.tags ?? {}),
    exception: {
      values: event.exception?.values?.slice(0, 3).map((exception) => ({
        type: safeErrorName(exception.type),
        value: `${safeErrorName(exception.type)}: operation failed (details withheld)`,
        stacktrace: {
          frames: exception.stacktrace?.frames?.slice(-30).map((frame) => ({
            filename: codeFilename(frame.filename),
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        },
      })),
    },
  } as T;
}

function safeTags(fields: LogFields): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sanitizeFields(fields))
      .filter(
        ([, value]) =>
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean",
      )
      .map(([key, value]) => [key, String(value)]),
  );
}

export function captureSafely(
  capture: (
    error: unknown,
    context: { tags: Record<string, string> },
  ) => unknown,
  error: unknown,
  context: LogFields,
) {
  try {
    capture(error, { tags: safeTags(context) });
  } catch {
    /* Optional telemetry must not break requests. */
  }
}
