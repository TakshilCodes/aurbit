# Environments

Aurbit uses three isolated environment tiers. Resources and secrets must not be shared across tiers.

| Environment       | Purpose                                             | Resources                                                                                                | Secrets                                             |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Local             | Development on a contributor's machine              | Next.js development servers, Docker PostgreSQL on `localhost:5433`, and Docker Redis on `localhost:6379` | Untracked local environment files                   |
| Preview / Staging | Review and integration validation before production | Separate Cloudflare Workers and separate remote data services from production                            | Configured in the hosting platform, never committed |
| Production        | Live customer traffic                               | Dedicated production Workers and production-only data services                                           | Configured in the hosting platform, never committed |

## Current variables

The only variable currently required by the repository is `DATABASE_URL` for `@aurbit/db`; its local example is in `packages/db/.env.example`.

Remote database and Redis resources are not configured in this stage because neither application consumes them yet. When they are introduced, Preview / Staging and Production must receive different connection values through their environment-specific secret stores.

## Cloudflare applications

The applications remain independently buildable and deployable:

- `apps/web` targets `aurbit.takshil.in`.
- `apps/admin` targets `admin.aurbit.takshil.in`.

Stage 3 provides local Cloudflare-compatible builds and previews only. Custom domains, remote secrets, and production deployment automation are intentionally deferred until the real deployment stage.

## Local compatibility checks

Run `pnpm build:cloudflare` to produce Cloudflare Worker bundles for both applications.

Run `pnpm preview:cloudflare:web` or `pnpm preview:cloudflare:admin` to build and serve one application in the local Workers runtime. These preview commands are intentionally separate because each application is deployed independently.

OpenNext is not fully compatible with native Windows because its bundle step creates symbolic links. On Windows, run Cloudflare builds and previews from WSL or another Linux environment. Standard `pnpm dev` development remains unchanged.
