# Environments

Aurbit uses three isolated environment tiers. Resources and secrets must not be shared across tiers.

| Environment       | Purpose                                             | Resources                                                                                                | Secrets                                             |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Local             | Development on a contributor's machine              | Next.js development servers, Docker PostgreSQL on `localhost:5433`, and Docker Redis on `localhost:6379` | Untracked local environment files                   |
| Preview / Staging | Review and integration validation before production | Separate Cloudflare Workers and separate remote data services from production                            | Configured in the hosting platform, never committed |
| Production        | Live customer traffic                               | Dedicated production Workers and production-only data services                                           | Configured in the hosting platform, never committed |

## Current variables

`packages/db/.env.example` documents `DATABASE_URL` for Prisma commands. `apps/admin/.env.example` documents the authenticated dashboard, and `apps/web/.env.example` documents the public application:

- `DATABASE_URL` connects the admin application to PostgreSQL.
- `AUTH_SECRET` signs and encrypts Auth.js session data and must be unique per environment.
- `AUTH_URL` is the canonical admin application URL used in authentication links.
- `PUBLIC_APP_URL` is the canonical public application URL used to validate Turnstile hostnames for bug reports.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` enable Google sign-in when both are configured.
- `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM` enable magic links, email verification, and password-reset email when both are configured.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` renders Cloudflare Turnstile; `TURNSTILE_SECRET_KEY` validates auth and public-report tokens server-side in their respective applications.
- `REDIS_URL` connects local rate limiting to the existing Docker Redis service.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` connect staging and production rate limiting to Redis over HTTP.

Provider-backed flows remain unavailable when their credentials are absent; the application does not substitute fake providers or secrets. Preview / Staging and Production must use separate databases, OAuth applications or callback configuration where required, Resend configuration, and secrets supplied through their environment-specific secret stores. Rate limiting selects one backend from explicit environment configuration: complete Upstash REST credentials take precedence for Cloudflare preview/staging/production; otherwise `REDIS_URL` uses the existing Docker Redis service for local development. Partial Upstash configuration or a missing backend fails closed.

## Cloudflare applications

The applications remain independently buildable and deployable:

- `apps/web` targets `aurbit.takshil.in`.
- `apps/admin` targets `admin.aurbit.takshil.in`.

Stage 3 provides local Cloudflare-compatible builds and previews only. Custom domains, remote secrets, and production deployment automation are intentionally deferred until the real deployment stage.

## Private report attachments

Both `apps/web` and `apps/admin` declare an R2 binding named `BUG_REPORT_ATTACHMENTS`. Within an environment, bind both Workers to the same private R2 bucket: the public application writes validated report attachments and the authenticated admin application reads them through a tenant-scoped route. Do not enable public bucket access.

Choose separate buckets for preview/staging and production. Bucket names and Cloudflare account details are deployment configuration and are intentionally not committed to the repository.

Local `pnpm dev` uses Wrangler's local R2 simulation through OpenNext, so submitting reports with attachments does not require a real Cloudflare bucket. Each application has isolated local simulation state to avoid database locking during parallel development and builds. To test the complete cross-application upload-and-admin-download path, configure the same `BUG_REPORT_ATTACHMENTS` binding for both application Workers against a private non-production R2 bucket.

### Real R2 verification checklist

Real-bucket testing is deferred until a private non-production bucket is available. Before promoting attachment storage to production, verify all of the following against staging:

1. Bind both staging Workers to the same private bucket as `BUG_REPORT_ATTACHMENTS` and confirm public access remains disabled.
2. Submit PNG, JPEG, and WebP images through both the hosted report page and the customer-site widget iframe.
3. Confirm every object uses `bug-reports/<random-submission-id>/<random-object-id>.<detected-extension>` and never contains a reporter filename or tenant identifier.
4. Confirm the R2 object size and HTTP content type match the associated `Attachment` row.
5. Confirm unsupported, empty, oversized, signature-mismatched, and excess files create neither R2 objects nor attachment rows.
6. Force an R2 upload failure and a database creation failure; confirm the user sees a generic error and every attempted object is deleted where the R2 operation completed or may have completed.
7. Confirm an authenticated member can download an attachment through the admin route, while signed-out and cross-tenant users cannot access it.
8. Confirm direct bucket URLs and guessed object keys do not provide public access.
9. Confirm staging and production use different buckets, and run the Cloudflare/OpenNext build and preview from Linux or WSL.

## Local compatibility checks

Run `pnpm build:cloudflare` to produce Cloudflare Worker bundles for both applications.

Run `pnpm preview:cloudflare:web` or `pnpm preview:cloudflare:admin` to build and serve one application in the local Workers runtime. These preview commands are intentionally separate because each application is deployed independently.

OpenNext is not fully compatible with native Windows because its bundle step creates symbolic links. On Windows, run Cloudflare builds and previews from WSL or another Linux environment. Standard `pnpm dev` development remains unchanged.
