# Daily invitation cleanup (Stage 9)

The existing `apps/worker` handles one Cron schedule: `0 3 * * *`, daily at
03:00 UTC (08:30 India time). Local, staging and production configs explicitly
declare the same schedule for their respective Worker. Queue handling is unchanged.

`scheduled()` awaits `runScheduledMaintenance()` → `cleanupOldInvites()`.
The cutoff is the scheduled execution time minus exactly 30 × 24 hours.
An invitation is eligible only when **all** of these are true:

- `expiresAt < cutoff` (never remove unexpired or recently expired invitations).
- `lastSentAt < cutoff`.
- `acceptedAt IS NULL OR acceptedAt < cutoff`.
- `revokedAt IS NULL OR revokedAt < cutoff`.

This conservatively retains accepted/revoked invitations until their original
expiry and latest activity have both aged out. Exactly-at-cutoff records remain
until a later run. Accepted membership is separate and is not deleted. Audit
entries remain; old invitation URLs eventually become invalid/not found.

Each execution selects at most 500 IDs, oldest expiry first, then performs one
`deleteMany` restricted to those IDs **and the same eligibility predicate**.
This re-check protects concurrent resends/revocations. No full invitation records
are loaded. Repeated/overlapping runs are safe: already-deleted rows no longer
match. Backlog remains for the next daily run; there is no unbounded loop.
An expiry index supports the cross-workspace scan.

Each scheduled invocation owns and closes a database client created by the
existing shared factory. Workers sockets must not be reused across invocations;
this also avoids disconnecting a concurrent Queue handler's database client.

The structured success log includes job, deleted count, duration and whether the
500-row limit was reached. Failure logs exclude database error text/record data
and rethrow the error so the scheduled execution is marked failed. There is no
custom retry mechanism; the next daily run can catch remaining eligible records.

## Local testing

Use a disposable/local database, **not production**. This performs real deletion;
expired invitation rows are not recoverable without a backup. Use the existing
Docker Postgres and `DATABASE_URL` in `apps/worker/.dev.vars`. No email/provider
credentials or new environment variables are required for Cron itself.

From the repository root:

```sh
pnpm --filter @aurbit/db db:migrate:deploy
pnpm --filter @aurbit/worker test
pnpm --filter @aurbit/worker exec wrangler dev --test-scheduled --port 8790 --persist-to ../../.wrangler/state/cron
```

The migration command uses the database configured in `packages/db/.env`; ensure
it points at the same local database as the Worker. Avoid running a second copy
of the same Worker alongside `pnpm dev` when testing.

In a second terminal (PowerShell):

```powershell
Invoke-WebRequest 'http://localhost:8790/cdn-cgi/handler/scheduled?cron=0+3+*+*+*'
```

Wrangler exposes this **local-only** scheduled testing route; no production
HTTP trigger is implemented. Local development does not automatically fire the
daily schedule. Expect `scheduled_maintenance_completed` with `deletedCount`.
Create test invitations whose expiry/last-send are over 30 days old (with old or
null acceptance/revocation); compare with unexpired and 29-day-expired fixtures.
Trigger twice: the second run should delete zero if no other eligible backlog
remains. Unit tests also exercise the boundary, resend race, batch limit and
failure propagation without needing a database.

For deterministic fixture testing, append `&time=<Unix milliseconds>` to that
URL to set the scheduled time. Use only a disposable database when overriding
time. The older `/__scheduled` alias works with `--test-scheduled` but ignores
the time override in the currently installed Wrangler version.

See Cloudflare's [local Cron testing documentation](https://developers.cloudflare.com/workers/configuration/cron-triggers/#test-cron-triggers-locally).

## Deployment

Apply the expiry-index migration to the intended database first. Deploy the
existing Worker using its intended Wrangler environment (`staging` or
`production`); the config installs the Cron Trigger. Preserve the Worker's
existing database secret and Queue bindings. Cron runs against that environment's
database. No separate Worker, manual production endpoint, Redis lock, or new
secret is needed. Verify the schedule and execution logs in Cloudflare after
deployment; Cron changes can take several minutes to propagate.
