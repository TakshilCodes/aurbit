# Outbound webhooks (Stage 8C)

Workspace OWNER/ADMIN users manage endpoints at
`/organizations/<workspace-id>/webhooks`. MEMBER users cannot read configuration
or delivery history or perform mutations. All operations recheck membership and
scope endpoint IDs to the workspace. Up to **10 endpoints per workspace**.
Configuration changes and their audit records commit atomically.

## Events and payload

| Event             | Emitted after                                                          |
| ----------------- | ---------------------------------------------------------------------- |
| `report.created`  | Successful public report creation, including attachments/metadata      |
| `report.updated`  | A changed priority or a status transition other than entering RESOLVED |
| `report.resolved` | Status changes from another status to RESOLVED                         |

No-op updates, assignee changes, and internal notes do not emit webhooks.
There is no reporter-resolution email. `report.created` emails remain a separate
Worker side effect; an email failure cannot suppress webhook execution.

The Queue carries only identifiers and event metadata. The Worker resolves the
report's workspace and selects enabled endpoints subscribed to the event. An
endpoint created after the event is not sent historical events.

```json
{
  "id": "77d8bc7b-f20c-42c3-905a-a6f3211502d7",
  "type": "report.created",
  "version": 1,
  "createdAt": "2026-08-30T12:00:00.000Z",
  "data": {
    "reportId": "report_id",
    "projectKey": "public_project_key",
    "title": "Save button does not respond",
    "status": "OPEN",
    "priority": "MEDIUM"
  }
}
```

`createdAt` is the event time. Data reflects current report state when the
Worker first prepares that endpoint's delivery, not a historical mutation
snapshot. For example, a resolved event processed after reopening can contain
the current OPEN status. Delivery stores the small serialized payload so its
body stays identical on retry, even if the report subsequently changes.
No description, reporter email, organization ID, internal notes, private
attachment links, credentials, or raw auth tokens are included. Report titles
are customer content: receivers must render them as text, not trusted HTML.

## Signing and receiver verification

Every POST includes:

- `Content-Type: application/json`
- `Aurbit-Event-Id`: same UUID as body `id`
- `Aurbit-Event-Type`: same event type as body `type`
- `Aurbit-Timestamp`: Unix seconds, regenerated on every attempt
- `Aurbit-Signature`: `v1=` followed by lowercase hex HMAC SHA-256

The HMAC key is the literal full signing-secret string (including `whsec_`).
The signed bytes are UTF-8 `timestamp + "." + rawBody`. Do not parse or reformat
JSON before verifying. Example Node receiver pseudocode:

```js
const timestamp = req.headers["aurbit-timestamp"];
const signature = req.headers["aurbit-signature"];
if (typeof timestamp !== "string" || !/^\d+$/.test(timestamp)) reject();
if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) reject();
if (typeof signature !== "string" || !/^v1=[a-f0-9]{64}$/.test(signature))
  reject();
const expected = createHmac("sha256", endpointSecret)
  .update(timestamp + ".")
  .update(rawBodyBytes)
  .digest();
const received = Buffer.from(signature.slice(3), "hex");
if (!timingSafeEqual(expected, received)) reject();
const event = JSON.parse(rawBodyBytes.toString("utf8"));
if (
  event.id !== req.headers["aurbit-event-id"] ||
  event.type !== req.headers["aurbit-event-type"]
)
  reject();
// Durably deduplicate event.id together with your business mutation.
// Already processed? Return 2xx without repeating the side effect.
```

Keep receiver clocks synchronized; the five-minute timestamp window is a
recommendation, not an exactly-once guarantee. Authenticate before using IDs
for deduplication, and retain durable receiver deduplication across restarts.

## Secrets and configuration

Signing secrets use 32 cryptographically random bytes, are shown only after
creation/rotation, and are stored encrypted with AES-256-GCM. Random nonces and
workspace/endpoint-bound authenticated data prevent ciphertext substitution.
Secret rotation replaces the old signing secret immediately for future
attempts. An already in-flight request may still use the old secret. There is
no old-secret grace period or stored-plaintext read endpoint.

Generate one encryption key per environment:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set the same `WEBHOOK_ENCRYPTION_KEY` in `apps/admin/.env.local` and
`apps/worker/.dev.vars` locally. In staging/production, set it in the admin Vercel project and as a Wrangler secret on the background Worker, e.g.:

```sh
pnpm --filter @aurbit/worker exec wrangler secret put WEBHOOK_ENCRYPTION_KEY --env staging
```

Use `--env production` separately with a different key. Back up this key
securely: replacing it without re-encrypting stored endpoint secrets makes
existing deliveries fail. Key-ring/master-key rotation tooling is not included.
Do not put this key, endpoint secrets, or production database URLs in Git.

Apply `pnpm --filter @aurbit/db db:migrate:deploy` and generate Prisma clients.
The new migration creates `webhook_endpoints`, `webhook_deliveries`, and the
delivery status enum. Deploy admin and web to matching Vercel environments and
the Worker to the matching Cloudflare environment. Admin publishes events through
the Queue HTTP adapter. No new Queue, R2 bucket, Cron, email provider, or
public API is introduced.

## Destinations and SSRF boundary

Production/staging accept only public HTTPS hostnames on port 443. URLs with
credentials, fragments, IP literals (including encoded IP forms), internal
hostnames, or other protocols/ports are rejected. Both A and AAAA records are
checked using Cloudflare DNS-over-HTTPS on save and before each send. Any
private, loopback, link-local, mapped/tunnel, multicast, or reserved answer
rejects the destination. DNS failure fails closed. Redirects are never followed;
no customer response body is stored or logged. Requests have an **8-second**
deadline including DNS preflight and HTTP delivery.

Important limit: Cloudflare Workers fetch does not allow arbitrary customer
hostnames to be pinned to the validated DNS address. DNS is resolved again by
fetch, so preflight checks alone do not eliminate DNS rebinding. This Worker
has no VPC/private-service bindings. Do not add private-network connectivity
without a DNS-pinned egress solution and a security review. Hardened egress
proxy infrastructure is intentionally not introduced in this stage.

Local HTTP is allowed only with **both** an explicit opt-in and local runtime:
admin `NODE_ENV=development`, Worker `AURBIT_ENV=local`, and
`WEBHOOK_LOCAL_TESTING=true` in each app. The exception accepts only loopback
hosts on port **8789**. Staging/production Worker configs explicitly override
`AURBIT_ENV`; they ignore the local-testing flag.

## Delivery, retries and history

- Logical delivery key: unique `(webhookEndpointId, eventId)` in PostgreSQL.
- An atomic 60-second lease/token prevents normal concurrent duplicate sends.
  Completion updates are guarded by that token.
- A 2xx marks DELIVERED. Successful and permanently failed records are skipped
  on retries. Endpoints are processed independently; one failure does not stop
  attempts to the others. Disabled/unsubscribed endpoints are skipped; deleted
  endpoints and their delivery history are removed together.
  Disabling/deleting cannot recall a request that is already in flight.
- Network/timeouts, 408, 425, 429, and 5xx retry. Redirects and other 4xx fail
  permanently. Safe codes, not arbitrary response text, are stored.
- Queue backoff is 30, 60, then 120 seconds for three retries (four total Queue
  attempts). Each endpoint is capped at four HTTP attempts. Existing queues
  keep batch size 10, batch timeout 5 seconds, and environment-specific DLQs.
  Persistent dependency/DB failures also go through these bounded Queue retries.
- A crash after the customer accepts a request but before the DB records
  success can still cause a duplicate. Queue delivery is at-least-once, not
  exactly-once. A lost completion write or an expired lease never grants an
  exactly-once promise. Customers must deduplicate the event ID.
- History shows **20 logical deliveries per page**, newest first, with latest
  outcome/HTTP status, attempt count, event ID/type, endpoint, and timestamp.
  It is not a separate append-only record of every attempt. No secrets or
  payload bodies are exposed by the history query.
- DB mutation commits before enqueue. If Queue send fails, the successful
  report mutation stays successful and logs `async_event_enqueue_failed`.
  That event can be lost; a transactional outbox remains deferred.

## Local testing

1. Keep existing Docker PostgreSQL/Redis running; apply migrations.
2. Configure the shared encryption key and local-testing flag above. Start
   `pnpm dev` (web, admin, and real Wrangler local Queue consumer).
3. In workspace **Webhooks**, create `http://127.0.0.1:8789/aurbit`, subscribing
   to the events you want. Copy the one-time signing secret.
4. In another PowerShell terminal:

   ```powershell
   $env:WEBHOOK_TEST_SECRET = "<one-time endpoint signing secret>"
   pnpm --filter @aurbit/worker dev:webhook-receiver
   ```

   The fixture listens only on loopback, validates HMAC over raw bytes plus
   timestamp, logs event ID/type only, and returns 204.

5. Submit a public report, change its priority/status, or resolve it. Check
   `webhook_verified` in the receiver, Worker logs, and **Refresh history**.
   To avoid Resend entirely, use priority/status changes on an existing report:
   those events are webhook-only. New-report events still use Stage 8B email
   settings; without Resend configuration the email effect retries, but a
   successfully delivered webhook is not resent.
6. Stop the receiver and trigger another event to inspect bounded retries.
   Rotate the endpoint secret and update the receiver to test rotation.

`pnpm test` uses mocked providers; no real emails or customer requests.
`pnpm test:queue` checks actual workerd startup/RPC/Queue routing and intentional
retry on an unreachable dummy database, with isolated temporary state.
For an automated successful local delivery, explicitly set `DATABASE_URL` to
Docker PostgreSQL on port 5433 and run
`pnpm --filter @aurbit/worker test:webhook:local` (Node 22+). It refuses remote
databases, creates a disposable workspace/report/endpoint, generates temporary
secrets, runs the actual Queue/Worker against a loopback signature verifier,
asserts a 204 DELIVERED record, then removes its own fixtures. Port 8789 must
be free. It never sends email or contacts customer endpoints.
Vercel validates the Next.js runtime; the Worker remains independently validated with Wrangler.

Deferred: manual `webhook.test` button, replay UI, full per-attempt archive,
retention cleanup, master-key rotation tooling, outbox, hardened egress proxy,
and third-party integrations. No fake test event or unused configuration is
included. Verify a controlled public HTTPS receiver, secret rotation, DNS
rejection, retry/DLQ behavior, and tenant-scoped history in staging before launch.
