export type LogFields = Record<string, unknown>;
export type LogLevel = "debug" | "info" | "warn" | "error";
export type Service = "aurbit-web" | "aurbit-admin" | "aurbit-worker";
export type LogRecord = LogFields & {
  timestamp: string;
  level: LogLevel;
  service: Service;
  environment: string;
  message: string;
};

// Operational metadata only. New fields require a deliberate privacy review.
const fields = new Set([
  "requestId",
  "eventId",
  "eventType",
  "reportId",
  "projectId",
  "organizationId",
  "userId",
  "memberId",
  "endpointId",
  "deliveryId",
  "providerMessageId",
  "messageId",
  "queue",
  "attempt",
  "attempts",
  "durationMs",
  "responseStatus",
  "retryable",
  "retryDelaySeconds",
  "errorCode",
  "notificationType",
  "recipientCount",
  "sentCount",
  "skippedCount",
  "retryableFailureCount",
  "job",
  "scheduledRunId",
  "scheduledTime",
  "deletedCount",
  "batchLimitReached",
  "success",
  "flow",
  "reason",
  "stage",
  "attachmentCount",
  "cleanupCount",
  "method",
  "route",
  "service",
  "environment",
]);
const errorNames = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "AbortError",
  "TimeoutError",
  "ZodError",
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
  "PrismaClientInitializationError",
  "EmailProviderError",
  "RetryableEventProcessingError",
  "PermanentEventProcessingError",
  "AuthenticationError",
  "AuthorizationError",
  "AuthError",
  "CredentialsSignin",
]);
const errorCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ABORT_ERR",
  "report_not_found",
  "webhook_delivery_retry",
  "email_delivery_incomplete",
  "provider_request_failed",
  "delivery_state_update_failed",
  "delivery_configuration_error",
  "validation_error",
  "invalid_parameter",
  "missing_required_field",
  "invalid_access",
  "restricted_api_key",
  "invalid_api_key",
  "rate_limit_exceeded",
  "application_error",
]);

export function runtimeEnvironment(
  value?: string,
  nodeEnvironment?: string,
): string {
  if (value === "staging" || value === "production" || value === "local")
    return value;
  if (nodeEnvironment === "test") return "test";
  return nodeEnvironment === "production" ? "production" : "local";
}

export function safeErrorName(value: unknown): string {
  return typeof value === "string" && errorNames.has(value) ? value : "Error";
}

export function serializeError(error: unknown): {
  name: string;
  message: string;
  code?: string;
} {
  // Raw provider/Prisma messages can embed SQL, passwords, URLs or submitted text.
  // Never enumerate the error, its cause, request, response, or arbitrary properties.
  try {
    const object = error instanceof Error ? error : undefined;
    const name = object ? safeErrorName(object.name) : "Error";
    const candidate: unknown =
      object && "code" in object ? object.code : undefined;
    const code =
      typeof candidate === "string" &&
      (errorCodes.has(candidate) || /^P\d{4}$/.test(candidate))
        ? candidate
        : undefined;
    return {
      name,
      message: code
        ? `${name}: ${code}`
        : `${name}: operation failed (details withheld)`,
      ...(code ? { code } : {}),
    };
  } catch {
    return {
      name: "Error",
      message: "Error: operation failed (details withheld)",
    };
  }
}

export function sanitizeFields(input: LogFields): LogFields {
  const result: LogFields = {};
  for (const key of Object.keys(input).slice(0, 40)) {
    // Do not execute getters on arbitrary objects.
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    const value: unknown = descriptor?.value;
    if (key === "error") {
      result.error = serializeError(value);
      continue;
    }
    if (!fields.has(key)) continue;
    if (
      typeof value === "string" &&
      value.length <= 160 &&
      /^[a-zA-Z0-9_.:/ -]*$/.test(value)
    ) {
      result[key] = value;
    } else if (
      typeof value === "boolean" ||
      value === null ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      result[key] = value;
    }
  }
  return result;
}

export type Logger = Record<
  LogLevel,
  (message: string, fields?: LogFields) => void
> & {
  child(fields: LogFields): Logger;
};

export function createLogger(
  options: {
    service: Service;
    environment: string | (() => string);
    // Receives only the same sanitized record written to stdout.
    sink?: (record: LogRecord) => void;
  },
  context: LogFields = {},
): Logger {
  const base = sanitizeFields(context);
  const write = (
    level: LogLevel,
    message: string,
    metadata: LogFields = {},
  ) => {
    // Observability must never change a business operation's outcome.
    try {
      const environment =
        typeof options.environment === "function"
          ? options.environment()
          : options.environment;
      if (
        level === "debug" &&
        environment !== "local" &&
        environment !== "test"
      )
        return;
      const record: LogRecord = {
        ...base,
        ...sanitizeFields(metadata),
        timestamp: new Date().toISOString(),
        level,
        service: options.service,
        environment,
        message: /^[a-z][a-z0-9_]{0,95}$/.test(message)
          ? message
          : "invalid_log_event_name",
      };
      try {
        console[level](JSON.stringify(record));
      } catch {
        /* Stdout failure must not prevent optional export. */
      }
      try {
        options.sink?.(record);
      } catch {
        /* Export failure must not affect the caller. */
      }
    } catch {
      /* No recursive logging if serialization or the output sink fails. */
    }
  };
  return {
    debug: (message, metadata) => write("debug", message, metadata),
    info: (message, metadata) => write("info", message, metadata),
    warn: (message, metadata) => write("warn", message, metadata),
    error: (message, metadata) => write("error", message, metadata),
    child: (metadata) =>
      createLogger(options, { ...base, ...sanitizeFields(metadata) }),
  };
}
