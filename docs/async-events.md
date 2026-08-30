# Async events

Aurbit's Stage 8A async pipeline is:

```text
apps/web server mutation
  -> AURBIT_EVENTS Queue binding
  -> aurbit-events-* Cloudflare Queue
  -> apps/worker queue consumer
  -> schema validation, routing, structured processing log, acknowledgement
```

Stage 8C emits `report.created`, `report.updated`, and `report.resolved` from
real committed mutations. Updated means priority changes or status changes
other than entering RESOLVED. Resolved is webhook-only, not a reporter email.
See [webhooks.md](webhooks.md) for the signed customer event contract.

## Event envelope

Events contain only `type`, `version`, `eventId`, `occurredAt`, and `reportId`.
They never contain report text, reporter details, authentication data,
attachments, or secrets. Version 1 currently supports:

- `report.created`
- `report.resolved`
- `report.updated`

The producer generates a UUID `eventId` once and sends the validated envelope.
The `report.created` email handler combines the stable event ID with a durable
per-recipient `EmailDelivery` record. The delivery ID becomes the Resend
idempotency key, preventing normal Queue retries from sending the same
notification twice.

## Failure behavior

- The report database write completes before enqueueing.
- If the database write fails, no event is sent.
- If enqueueing fails after the database commit, the report remains successful
  and the server emits a structured `async_event_enqueue_failed` error. The
  public response remains successful to avoid duplicate reports from retries.
- This leaves a documented delivery gap until a transactional outbox is added
  if delivery guarantees become necessary.
- Valid messages whose handlers fail are retried individually.
- Malformed or unsupported messages are treated as permanent poison messages,
  logged without their body, and acknowledged.
- Successful messages are explicitly acknowledged.

## Report-created email notification

The Worker loads the report through its project and organization relationship,
then emails only valid, deduplicated OWNER and ADMIN member addresses from that
organization. MEMBER users, unrelated organizations, and client-supplied
recipient data are never included.

Each recipient is processed independently. `SENT` and `PERMANENT_FAILURE`
delivery rows are skipped on retry. Transient Resend or persistence failures
leave the Queue event retryable, while a permanent bad-recipient/provider
validation failure is recorded and does not block valid recipients.

The email contains the report title, project, workspace, submission timestamp,
optional reporter email, and an authenticated admin report link. It excludes
the report description, attachment URLs, internal notes, secrets, and tokens.

Each environment uses a batch size of 10, a five-second batch timeout, and
three retries. Messages that still fail go to the environment's dead-letter
queue.

## Queue names

| Environment   | Main queue                 | Dead-letter queue              |
| ------------- | -------------------------- | ------------------------------ |
| Local/default | `aurbit-events-local`      | `aurbit-events-local-dlq`      |
| Staging       | `aurbit-events-staging`    | `aurbit-events-staging-dlq`    |
| Production    | `aurbit-events-production` | `aurbit-events-production-dlq` |

Create the staging/production main queues before deployment. Wrangler creates
the configured dead-letter queue automatically when needed.

## Local end-to-end test

`pnpm dev` and `pnpm dev:queue` both start web (port 3000), admin (port 3001),
and the Queue consumer. Neither command runs an OpenNext production build.

Next dev's binding proxy and a standalone Wrangler consumer have separate
Queue simulators. In development only, the web producer uses the
`AURBIT_EVENTS_LOCAL` service binding to call the Worker's `LocalQueueProducer`
RPC entrypoint. That entrypoint validates the event and calls
`LOCAL_AURBIT_EVENTS.send()` in the consumer's own simulator. It does not call
the notification handler directly or expose an HTTP upload/enqueue endpoint.
Staging/production have no local service/producer bindings and continue to
send directly to `AURBIT_EVENTS`. If the local Worker is stopped, enqueueing
fails visibly in server logs; there is no fallback to a disconnected queue.

For a real local producer-to-consumer Queue test:

1. Keep Docker PostgreSQL and Redis running. Ensure `apps/web/.env.local`
   contains the existing local database, Redis, and Turnstile values, with
   `PUBLIC_APP_URL=http://localhost:3000`. Keep existing R2 dev bindings intact.
2. Copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars`. Set
   `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM` only when you intentionally want a
   locally queued report to send through Resend. Automated tests always mock
   the provider and never send real email.
3. Apply any pending Prisma migrations to the local development database and
   run `pnpm --filter @aurbit/db db:generate`. The runtime-selection fix itself
   does not change database tables or require a new migration.
4. Run `pnpm dev:queue` from the repository root.
5. Open `http://localhost:3000/report/<project-public-key>`, submit a valid
   report, and observe the worker's structured notification logs. Restart
   existing dev processes after changing bindings or generated clients.

The consumer's local Queue state is under `.wrangler/state/worker` (gitignored).
Run `pnpm test:queue` for an isolated real-runtime smoke test: it checks Worker
startup (including the Prisma import), rejects malformed RPC input, and sends
a `report.resolved` event through RPC -> Queue -> consumer, asserting a retry
when the intentionally unreachable dummy database prevents processing.
The test uses temporary configuration/state and dummy provider credentials,
never reads local email secrets, and never sends email. Provider-mocked unit
tests cover the `report.created` notification behavior separately.

For production-like full OpenNext preview, `pnpm preview:cloudflare:queue`
retains the build-and-multi-Worker Wrangler workflow with state under
`.wrangler/state/queues`. This is separate from everyday development.

Native Windows OpenNext packaging can fail on symlink permissions or pnpm links
pointing outside the patched bundle. Linux/WSL is recommended for full preview;
it is not required for the normal Next dev + local Queue workflow above.

## Prisma runtimes

The schema generates Node and Cloudflare clients from the same models.
The private `#prisma-client` package import selects the Cloudflare client for
the `workerd` build condition (Wrangler/OpenNext), and the Node client otherwise
(Next dev, Vitest, Node scripts). Both use the existing shared lazy database
helper and PostgreSQL adapter; no second database or duplicate query logic is
introduced. Selecting the Node client inside Workers causes `fileURLToPath`
startup errors; selecting the Cloudflare client in plain Node can break WASM
loading, so both paths must be preserved.

## Deployment

Deploy the web/admin producers and worker with the same environment name so their
queue names match. For example, use `--env staging` for both staging
deployments and `--env production` for both production deployments. The worker
is independently buildable and deployable from `apps/worker`.

Configure these Worker secrets/bindings independently for staging and
production before processing `report.created`:

- `DATABASE_URL`
- `AUTH_RESEND_KEY`
- `AUTH_EMAIL_FROM`
- `AUTH_URL` (the canonical admin application URL used for report links/assets)

Do not commit real values. Use a verified Resend sending domain in staging and
production.
