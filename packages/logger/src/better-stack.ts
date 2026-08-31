import { createLogger, type LogRecord } from "./index";

export type BetterStackConfig = { host?: string; token?: string };
const MAX_RECORDS = 100;
const MAX_BYTES = 128 * 1024;
const TIMEOUT_MS = 3_000;

function destination(config: BetterStackConfig): string | undefined {
  if (
    !config.host ||
    !config.token ||
    !/^[\x21-\x7e]{1,512}$/.test(config.token)
  )
    return undefined;
  try {
    const url = new URL(
      config.host.includes("://") ? config.host : `https://${config.host}`,
    );
    // Only the provider-issued ingestion host; never arbitrary URLs or redirects.
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !(
        url.hostname.endsWith(".betterstackdata.com") ||
        url.hostname === "in.logs.betterstack.com"
      )
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function warn(record: LogRecord, reason: string, responseStatus?: number) {
  // Stdout only: never recursively send exporter failures to the exporter/Sentry.
  createLogger({
    service: record.service,
    environment: record.environment,
  }).warn("log_export_unavailable", { reason, responseStatus });
}

/** One bounded, best-effort batch per operation/invocation. No global buffers. */
export function createBetterStackBatch(config: BetterStackConfig) {
  const url = destination(config);
  const configured = Boolean(config.host || config.token);
  const records: string[] = [];
  let bytes = 2;
  let first: LogRecord | undefined;
  let warned = false;
  let closed = false;
  let pending: Promise<void> | undefined;
  function warning(record: LogRecord, reason: string) {
    if (!warned) {
      warned = true;
      warn(record, reason);
    }
  }

  return {
    enabled: Boolean(url),
    write(this: void, record: LogRecord) {
      if (!url) {
        if (configured) warning(record, "configuration_invalid");
        return;
      }
      if (closed) {
        warning(record, "batch_closed");
        return;
      }
      // The logger, not this provider adapter, owns field sanitization.
      const line = JSON.stringify({ ...record, dt: record.timestamp });
      const size = new TextEncoder().encode(line).byteLength + 1;
      if (records.length >= MAX_RECORDS || bytes + size > MAX_BYTES) {
        warning(record, "batch_limit_reached");
        return;
      }
      first ??= record;
      bytes += size;
      records.push(line);
    },
    flush(this: void): Promise<void> {
      if (pending) return pending;
      closed = true;
      if (!url || !first || records.length === 0) return Promise.resolve();
      const record = first;
      const body = `[${records.join(",")}]`;
      records.length = 0;
      pending = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.token}`,
            },
            body,
            redirect: "error",
            signal: controller.signal,
          });
          if (!response.ok) warn(record, "provider_rejected", response.status);
          // Never inspect/log a provider response body or credential-bearing URL.
          await response.body?.cancel();
        } catch {
          warn(
            record,
            controller.signal.aborted ? "timeout" : "network_failure",
          );
        } finally {
          clearTimeout(timer);
        }
      })();
      return pending;
    },
  };
}

/** The runtime supplies after()/waitUntil ownership, not an unawaited timer. */
export function createBackgroundLogSink(
  config: BetterStackConfig,
  schedule: (flush: () => Promise<void>) => void,
): (record: LogRecord) => void {
  const batch = createBetterStackBatch(config);
  let scheduled = false;
  return (record) => {
    batch.write(record);
    if (!batch.enabled || scheduled) return;
    scheduled = true;
    try {
      schedule(() => batch.flush());
    } catch {
      warn(record, "lifecycle_unavailable");
    }
  };
}
