# Stage 10A: logging and observability

## What the tools do

| Tool         | Purpose                                           | Aurbit setup                              |
| ------------ | ------------------------------------------------- | ----------------------------------------- |
| Logger       | Writes searchable records of important operations | Shared lightweight JSON logger            |
| Pino         | A library for writing structured logs             | Not used; no account/setup needed         |
| Better Stack | Hosted collection and search of operational logs  | Optional direct HTTPS application export  |
| Sentry       | Exception tracking, grouping and stack locations  | Optional official Next.js/Cloudflare SDKs |

The repository did not contain a Sentry SDK integration when this stage began. This implementation adds it. Tracing is disabled (`tracesSampleRate: 0`); Replay and Sentry Logs are not enabled. There was no existing intentional tracing/Replay setup to preserve.

Pino has different Node/browser behavior, including base fields and serialization. A portable logger with no runtime dependencies is simpler for this Next/OpenNext/Workers combination; no Node transports are bundled. This is not a claim that Pino cannot run in Workers.

## Code map

- `packages/logger/src/index.ts`: levels, service/environment/timestamp, bounded metadata allowlist, safe error serialization.
- `packages/logger/src/better-stack.ts`: provider host validation, bounded batches, authenticated HTTPS POST, timeout and stdout-only exporter diagnostics.
- `packages/logger/src/request.ts`: UUID request IDs.
- `packages/logger/src/sentry.ts`: DSN validation and privacy filtering of exception events.
- `apps/{web,admin}/lib/logger.ts`: app identity, request-scoped logging and Next `after()` scheduling.
- `apps/{web,admin}/proxy.ts`: overwrite incoming request IDs, forward generated IDs internally and return X-Request-Id.
- `apps/{web,admin}/lib/observability.ts`: log unexpected caught failures, capture in Sentry, flush after the response.
- `apps/{web,admin}/instrumentation.ts`: server initialization and uncaught Next request errors.
- `apps/{web,admin}/instrumentation-client.ts`: optional browser exception tracking.
- `apps/{web,admin}/app/global-error.tsx`: global fallback; server-digested errors are not captured again here.
- `apps/worker/src/{logger,observability,index}.ts`: Worker identity, per-invocation log batches and official Queue/Cron Sentry wrapper. `AsyncLocalStorage` keeps concurrent invocation batches isolated; `waitUntil()` owns their delivery.
- Worker consumer, notification, webhook and scheduled-maintenance modules retain their business behavior and use the common logger.

Example server usage:

```ts
logger.info("report_created", { reportId, projectId });
logger.error("webhook_processing_failed", { eventId, endpointId, error });
```

Records include timestamp, level, message, service and environment. Services: aurbit-web, aurbit-admin, aurbit-worker.

## Following a report through the code

1. Proxy generates requestId, ignoring even a valid browser-supplied UUID.
2. Database creation succeeds; report_created logs requestId/reportId/projectId.
3. Producer logs async_event_enqueued with requestId/reportId/eventId. This record bridges HTTP and background processing.
4. Queue processing uses eventId, then email/webhook deliveryId/endpointId. The Queue payload remains minimal.
5. Unexpected failures have the same correlation fields in logs and Sentry tags.

Cron creates a separate scheduledRunId. Outside an HTTP request, a helper can generate a fallback ID; unrelated jobs do not share a request ID. Static assets are excluded.

Levels: debug only local/test; info for significant successful boundaries; warn for expected rejection/permanent failure; error for unexpected failures and retryable processing failures. Not every HTTP request gets an application log.

## Privacy and failure behavior

The logger serializes only allowed scalar IDs/statuses/counts/timings, not arbitrary nested objects. Tokens, secrets, headers, email addresses, report descriptions, internal notes, email bodies and webhook payloads are dropped. Values are bounded. Never put sensitive values under an allowed ID key.

Raw Prisma/provider error messages can contain queries or credentials. Logs retain safe error name and recognized code, not raw message/stack/cause. Sentry retains bounded stack file/line locations and safe source-map debug IDs but removes messages, requests, users, breadcrumbs, locals, source context, query strings and arbitrary extras. Use static event names, codes and correlation IDs to investigate failures.

Logging always writes structured stdout and optionally exports the same sanitized records over HTTPS. Sink/export failures do not change business outcomes. Sentry capture/flush failures are guarded. Expected protection rejections and normal info records are not sent as exceptions. Unhandled errors use the framework/Worker integration; caught unexpected failures are captured at their boundary.

The direct exporter receives only Aurbit logger records, not arbitrary platform/dependency console messages. Inspect real exported records before forwarding production traffic. Database/auth/Queue retry behavior is unchanged.

## Local development

No monitoring account is required for `pnpm dev`. Leave DSNs and both Better Stack values empty; JSON logs appear in the terminal. Existing database/Redis/Turnstile/Queue/provider requirements for product features remain.

Optional values in each Next app's ignored .env.local:

```dotenv
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
BETTER_STACK_INGESTING_HOST=
BETTER_STACK_SOURCE_TOKEN=
```

Optional value in apps/worker/.dev.vars:

```dotenv
SENTRY_DSN=
BETTER_STACK_INGESTING_HOST=
BETTER_STACK_SOURCE_TOKEN=
```

Worker identity already uses AURBIT_ENV. Next public variables must be set **before building**. Browser DSNs are intentionally public ingestion identifiers; SENTRY_AUTH_TOKEN is a private build credential, never NEXT_PUBLIC.

## Sentry setup

1. Create a Sentry organization and three projects, e.g. aurbit-web, aurbit-admin, aurbit-worker. Select Next.js for the apps and Cloudflare Workers for the background Worker. Code is already installed; do not run a wizard over these files.
2. Copy each project's DSN from Client Keys / DSN settings. Set each app's NEXT_PUBLIC_SENTRY_DSN and NEXT_PUBLIC_APP_ENV=staging or production before its build.
3. Store the background Worker's SENTRY_DSN as an environment-specific Cloudflare secret. From apps/worker, use `pnpm exec wrangler secret put SENTRY_DSN --env staging`. Repeat intentionally for production.
4. For readable Next production stacks, create a Sentry upload token following its source-map instructions. Supply SENTRY_AUTH_TOKEN, SENTRY_ORG (slug), SENTRY_PROJECT (slug) in the private build environment. Use the correct project per app. Upload is disabled without the token. Worker source-map upload automation is deferred; bundled stack locations remain available.
5. Rebuild/deploy when ready. Existing nodejs_compat and compatibility date meet the documented OpenNext SDK requirements.
6. Trigger a controlled synthetic exception in non-production, containing no personal data. Verify project/environment, correlation tags, safe stack locations, privacy filtering, no duplicate captures, and source-map resolution for a real uploaded Next build.
7. Set appropriate retention/access controls. Tracing/Replay remain off until deliberately configured.

Missing/malformed DSNs disable initialization. A syntactically valid but incorrect DSN requires checking delivery/settings in Sentry; product requests must still work.

## Better Stack setup (direct HTTPS, no Logpush)

This replaces the earlier Logpush configuration. No Cloudflare Logpush job, Tail Worker, OpenTelemetry exporter, or monitoring queue is needed. The export method does not require Workers Paid; normal runtime limits and Better Stack ingestion quotas still apply. This does not change plan requirements for other Aurbit features.

### 1. Create a source

1. Create/sign in to a Better Stack account and open **Telemetry / Logs → Sources**.
2. Connect/create a source, such as **aurbit-local**. Use the HTTP/JSON ingestion instructions (an **Other** source where offered), not the Cloudflare Logpush integration.
3. Copy its **ingesting host** and **source token**. The source token authorizes ingestion; it is not your account-management API token.
4. One source can receive all three apps, distinguished by `service`. Use separate sources for local, staging and production to separate credentials, access and retention.

### 2. Configure local Aurbit

Add these to both Next apps' ignored `.env.local` files and the background Worker's ignored `.dev.vars`:

```dotenv
BETTER_STACK_INGESTING_HOST=YOUR_SOURCE_HOST.betterstackdata.com
BETTER_STACK_SOURCE_TOKEN=YOUR_SOURCE_TOKEN
```

Copy the actual host from Better Stack; do not use the placeholder. A bare host or its HTTPS root URL is accepted. The sender only allows `*.betterstackdata.com` or the legacy `in.logs.betterstack.com`, with no custom path, query, credentials or port. Redirects are refused. Do not paste an Authorization header or full Logpush URL into either setting.

Files:

- `apps/web/.env.local` for normal Next dev (port 3000).
- `apps/admin/.env.local` for normal Next dev (port 3001).
- `apps/worker/.dev.vars` for Wrangler Queue/Cron development.
- When running web/admin themselves under Wrangler/OpenNext preview, also supply their runtime values through their ignored `.dev.vars` or configured runtime secrets.

Never use a NEXT_PUBLIC prefix. Neither value is read by browser instrumentation. Restart the relevant local processes after changing configuration.

### 3. Verify delivery

1. Run normal local development with its existing DB/Redis/Turnstile setup.
2. Submit a harmless report. Look for `report_created` and `async_event_enqueued` in the terminal.
3. Open the source's Better Stack **Live tail**. These are top-level JSON records, not Cloudflare Logs/Message wrappers.
4. Inspect `service`, `environment`, `requestId`, `reportId` and `eventId`. The same eventId connects producer and Worker logs.
5. With the local Queue consumer running, look for its processing/delivery logs under `aurbit-worker`. Existing notification/webhook credentials are still needed for successful business delivery; their absence is unrelated to log export.
6. An existing admin triage action that enqueues an event can verify `aurbit-admin`.
7. Never provoke destructive Cron cleanup solely to test logs. Automated tests mock HTTP and require no Better Stack account.

No results? Check the correct source/time range and restart after configuration changes. Stdout `log_export_unavailable` includes a safe reason:

- `configuration_invalid`: one value is missing or the host/token format is invalid.
- `provider_rejected`: inspect the HTTP status (for example, 403 credentials, 402 quota, 429 throttling).
- `network_failure` / `timeout`: provider unreachable or the three-second deadline expired.
- `batch_limit_reached`: excess entries remained stdout-only.
- `lifecycle_unavailable`: no Next request lifecycle owns this operation (for example startup/build/tooling); no unawaited HTTP fallback is started.

Response bodies, URLs containing credentials, and tokens are never printed. A healthy exporter does not emit an extra success log for every batch.

### 4. Staging/production later

Create environment-specific sources. Set both values as runtime configuration on **each** deployed web/admin/background Worker; keep the source token secret. From each corresponding app directory:

```sh
pnpm exec wrangler secret put BETTER_STACK_INGESTING_HOST --env staging
pnpm exec wrangler secret put BETTER_STACK_SOURCE_TOKEN --env staging
```

Enter values interactively, not in command arguments. Repeat for production only when deliberately deploying there. Deploy the updated code through the existing deployment workflow. No Cloudflare Observability destination or paid log-export service needs enabling. The old `logpush: true` settings were removed; no real account job existed to delete. If a job was created separately, disable it to prevent duplicate forwarding.

### How code delivery works

```text
logger.info / warn / error
  → sanitize fields + add app identity/correlation
  → structured stdout
  → optional bounded batch
  → Next after() / Worker waitUntil()
  → HTTPS POST to Better Stack
```

- Existing business call sites still call `logger.info("report_created", { reportId })`; they do not know Better Stack URLs/tokens.
- A logger returned by `getRequestLogger()` shares one batch with its child loggers for that operation. Separate helper calls are separate batches. Unscoped Next logger calls schedule single-record batches rather than pooling data globally across requests.
- The Worker creates one batch per Queue batch or Cron invocation. AsyncLocalStorage routes existing logger calls to the correct invocation. The finally block registers flush even when business processing throws, preserving the original error.
- The provider module posts a JSON array with `Content-Type: application/json` and server-only `Authorization: Bearer …`. `dt` copies the original log timestamp for Better Stack's event-time field.
- Each batch permits at most **100 records / 128 KiB**, with **one POST / three-second timeout / no retries**. Duplicate flush calls share the same promise. Overflow stays in stdout and emits one batch-limit warning.
- Export failures never retry Queue business events, alter an HTTP response or replace a Cron error. Diagnostics go to stdout only, not recursively into the exporter or Sentry.
- This is **best-effort application logging**, not a durable delivery guarantee or full platform log drain. Crashes, lifecycle termination, limits and provider failures can lose remote entries. No process-global timer/buffer or additional background Worker is used.

Local HTTPS export is opt-in and really sends logs to the selected source. Leave both settings blank to keep everything stdout-only.

## Verification and rollout checklist

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @aurbit/worker test:queue
pnpm --filter @aurbit/worker exec wrangler deploy --dry-run --env staging --outdir dist
pnpm --filter @aurbit/worker exec wrangler deploy --dry-run --env production --outdir dist
```

Tests cover logger identity/privacy, optional sink failures, safe errors, request-ID propagation, deferred HTTPS delivery, bounded batches, timeouts, configuration failures and concurrent Worker event isolation. Tests do not send real email or monitoring data.

Real Better Stack ingestion, Sentry delivery/source-map resolution and deployed OpenNext checks require staging configuration. Use Linux/WSL for full Next/OpenNext builds; a successful Next build is not itself an OpenNext deployment check. No alerting platform, OTel, Replay, audit changes, health routes or deployment automation is added.

References:

- [Sentry Next.js setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Sentry OpenNext compatibility](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/nextjs/)
- [Sentry Cloudflare SDK](https://docs.sentry.io/platforms/javascript/guides/cloudflare/)
- [Better Stack HTTP ingestion](https://betterstack.com/docs/logs/ingesting-data/http/logs/)
- [Next after](https://nextjs.org/docs/app/api-reference/functions/after)
- [Cloudflare waitUntil](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil)
- [Pino browser behavior](https://github.com/pinojs/pino/blob/main/docs/browser.md)
