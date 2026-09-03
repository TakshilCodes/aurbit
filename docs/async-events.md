# Async events

Aurbit's asynchronous pipeline is:

```text
Vercel server mutation (apps/web or apps/admin)
  -> @aurbit/async-events
  -> Cloudflare Queues HTTP API
  -> environment-specific Cloudflare Queue
  -> apps/worker Queue consumer
  -> email notifications and/or signed outbound webhooks
```

## Event envelope

Events contain only `type`, `version`, `eventId`, `occurredAt`, and `reportId`. They never contain report text, reporter details, authentication data, attachments, or secrets. Version 1 supports `report.created`, `report.updated`, and `report.resolved`.

The producer creates one UUID event ID and validates the envelope before transport. Production uses a server-only Cloudflare API token and queue ID. The Worker parses the envelope again before routing it. Existing durable delivery records and provider idempotency keys make notification and webhook handlers tolerant of Queue retries.

## Failure behavior

- The database write completes before enqueueing.
- A failed database write sends no event.
- A failed enqueue after commit does not roll back the user-visible mutation; it emits `async_event_enqueue_failed` with the existing correlation fields.
- This leaves the existing delivery gap until a transactional outbox is deliberately added.
- Retryable handler failures are retried by Cloudflare Queues.
- Malformed or unsupported messages are logged without their body and acknowledged.

## Queue names

| Environment | Main queue                 | Dead-letter queue              |
| ----------- | -------------------------- | ------------------------------ |
| Local       | `aurbit-events-local`      | `aurbit-events-local-dlq`      |
| Staging     | `aurbit-events-staging`    | `aurbit-events-staging-dlq`    |
| Production  | `aurbit-events-production` | `aurbit-events-production-dlq` |

## Local flow

`pnpm dev` starts web, admin, and the Wrangler Worker. In development the Next producers POST only to the loopback URL `http://127.0.0.1:8787/__aurbit/events`. That endpoint exists only when `AURBIT_ENV=local`, validates the same event envelope, and sends it to `LOCAL_AURBIT_EVENTS` in Wrangler's local Queue simulator. It returns 404 in deployed environments and accepts no credentials or arbitrary Queue data.

Use ignored `.env.local` files for web/admin and `apps/worker/.dev.vars` for the Worker. Local attachment files use `.aurbit/storage`; Queue state uses `.wrangler/state/worker`.

`pnpm test:queue` starts an isolated real workerd instance, rejects malformed HTTP input, sends a valid event through HTTP -> Queue -> consumer, and verifies the expected retry path without real email or webhook calls.

## Deployment

Set these server-only values on each Vercel producer, using the matching environment's queue:

```dotenv
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_QUEUE_ID=
CLOUDFLARE_QUEUE_API_TOKEN=
```

The API token needs Cloudflare Queues Edit permission. Deploy `apps/worker` separately with Wrangler and its existing `staging` or `production` configuration. Worker-only values such as Resend credentials, `AUTH_URL`, webhook encryption, Sentry, Better Stack, database URL, Queue bindings, and Cron remain in Cloudflare.

The database package still generates Node and workerd Prisma clients from one schema. Vercel selects the default Node client; Wrangler selects the `workerd` client through the existing package import condition.
