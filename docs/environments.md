# Environments

Aurbit uses three isolated environment tiers. Resources and secrets must not be shared across tiers.

| Environment       | Purpose                                             | Resources                                                                                                | Secrets                                             |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Local             | Development on a contributor's machine              | Next.js development servers, Docker PostgreSQL on `localhost:5433`, and Docker Redis on `localhost:6379` | Untracked local environment files                   |
| Preview / Staging | Review and integration validation before production | Separate Cloudflare Workers and separate remote data services from production                            | Configured in the hosting platform, never committed |
| Production        | Live customer traffic                               | Dedicated production Workers and production-only data services                                           | Configured in the hosting platform, never committed |

## Current variables

`packages/db/.env.example` documents `DATABASE_URL` for Prisma commands. `apps/admin/.env.example` documents the variables used by the authenticated dashboard:

- `DATABASE_URL` connects the admin application to PostgreSQL.
- `AUTH_SECRET` signs and encrypts Auth.js session data and must be unique per environment.
- `AUTH_URL` is the canonical admin application URL used in authentication links.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` enable Google sign-in when both are configured.
- `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM` enable magic links, email verification, and password-reset email when both are configured.

Provider-backed flows remain unavailable when their credentials are absent; the application does not substitute fake providers or secrets. Preview / Staging and Production must use separate databases, OAuth applications or callback configuration where required, Resend configuration, and secrets supplied through their environment-specific secret stores. Redis remains local-only infrastructure in this stage because no feature consumes it yet.

## Cloudflare applications

The applications remain independently buildable and deployable:

- `apps/web` targets `aurbit.takshil.in`.
- `apps/admin` targets `admin.aurbit.takshil.in`.

Stage 3 provides local Cloudflare-compatible builds and previews only. Custom domains, remote secrets, and production deployment automation are intentionally deferred until the real deployment stage.

## Local compatibility checks

Run `pnpm build:cloudflare` to produce Cloudflare Worker bundles for both applications.

Run `pnpm preview:cloudflare:web` or `pnpm preview:cloudflare:admin` to build and serve one application in the local Workers runtime. These preview commands are intentionally separate because each application is deployed independently.

OpenNext is not fully compatible with native Windows because its bundle step creates symbolic links. On Windows, run Cloudflare builds and previews from WSL or another Linux environment. Standard `pnpm dev` development remains unchanged.
