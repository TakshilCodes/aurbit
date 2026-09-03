# Environments and deployment

Aurbit uses Local, Preview / Staging, and Production. Databases, Redis, R2 buckets, Queues, credentials, and secrets must be isolated between staging and production.

## Runtime ownership

| Runtime       | Hosting            | Responsibility                                                                |
| ------------- | ------------------ | ----------------------------------------------------------------------------- |
| `apps/web`    | Vercel             | Public site, widget, hosted report form, report and attachment creation       |
| `apps/admin`  | Vercel             | Auth.js, workspaces, triage, private attachment downloads, webhook management |
| `apps/worker` | Cloudflare Workers | Queue consumption, email notifications, outbound webhooks, and Cron           |

Cloudflare continues to provide DNS, Turnstile, private R2 buckets, Queues, and Cron. `aurbit.takshil.in` points to the web Vercel project and `admin.aurbit.takshil.in` points to the admin Vercel project.

## Local

Run Docker PostgreSQL on `localhost:5433` and Redis on `localhost:6379`, then run `pnpm dev`. The Next apps use their ignored `.env.local` files. The Cloudflare Worker uses `apps/worker/.dev.vars` and Wrangler's local Queue simulator.

Attachments are stored under the repository's ignored `.aurbit/storage` directory. Both Next apps use that directory, so an attachment uploaded by web can be downloaded by admin without a production R2 account. The local-only Queue producer posts validated event envelopes to `http://127.0.0.1:8787/__aurbit/events`; the Worker puts them into its local Queue. Set `AURBIT_LOCAL_QUEUE_URL` only when the local Worker uses another loopback port.

## Preview / Staging

Create two Vercel projects from this repository with root directories `apps/web` and `apps/admin`. Give both the Preview environment a staging database, staging Upstash Redis, staging R2 bucket/credentials, and the staging Cloudflare Queue ID/API token. Never point Preview at production resources.

Deploy `apps/worker` to its Cloudflare `staging` environment. Its Queue consumer, R2/Queue bindings, secrets, and database URL must match the staging tier.

## Production

Create the same two Vercel projects with production-only values and attach:

- `aurbit.takshil.in` to `apps/web`
- `admin.aurbit.takshil.in` to `apps/admin`

Deploy `apps/worker` with Wrangler's `production` environment. Cloudflare DNS may remain proxied, but the Next.js origin is Vercel.

## Vercel variables

Both Next apps require `DATABASE_URL`, `NEXT_PUBLIC_APP_ENV`, their existing Turnstile and rate-limit values, and:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_QUEUE_ID=
CLOUDFLARE_QUEUE_API_TOKEN=
```

R2 credentials are server-only S3 API credentials scoped to the private environment bucket. The Queue token is server-only and requires Cloudflare Queues Edit permission for the account. Use the queue's immutable ID, not its display name. Automated tests mock both providers.

Web also requires `PUBLIC_APP_URL` and its existing public-report Turnstile configuration. Admin requires its existing Auth.js, Resend, webhook, Turnstile, and observability values. `AUTH_URL` is `https://admin.aurbit.takshil.in` in production. Register this production Google OAuth redirect URI:

```text
https://admin.aurbit.takshil.in/api/auth/callback/google
```

Keep the localhost callback `http://localhost:3001/api/auth/callback/google` for development.

The complete per-app lists live in `apps/web/.env.example`, `apps/admin/.env.example`, and `apps/worker/.dev.vars.example`. Do not commit real values.

## R2 and uploads

Web and admin use R2's S3-compatible HTTPS API from Vercel; no Worker R2 binding is used by either Next app. Both deployments must target the same private bucket within an environment. Generated keys and tenant-scoped admin downloads remain unchanged. Failed report creation still deletes any objects uploaded for that submission.

Vercel Functions limit request and response bodies to 4.5 MB. The public form therefore accepts at most 4 MB of attachments in total, leaving multipart overhead. Larger-file/direct-upload infrastructure is intentionally not introduced by this runtime migration.

## Queue publishing

Web and admin send the existing versioned event envelope to Cloudflare's Queue HTTP endpoint. `apps/worker` remains the consumer and its retry, idempotency, email, webhook, logging, and Cron behavior is unchanged. A database commit remains successful if the subsequent enqueue fails; the producer logs the delivery gap as before.

## Vercel project settings

For each Vercel project, select the repository and set only the Root Directory (`apps/web` or `apps/admin`). Vercel detects Next.js and pnpm from the workspace. Keep the normal install and build defaults unless project inspection proves an override is needed; no `vercel.json` is required.
