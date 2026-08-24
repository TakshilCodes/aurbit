# Aurbit

Production-quality multi-tenant bug-reporting SaaS.

## Read first

- docs/product.md
- docs/design-system.md when working on UI

## Applications

- apps/web: public site, widget, iframe/reporting
- apps/admin: authenticated customer dashboard
- background Worker: Queues/Cron

## Deployment

- apps/web → Cloudflare Workers → aurbit.takshil.in
- apps/admin → Cloudflare Workers → admin.aurbit.takshil.in

## Stack

Next.js, TypeScript, Tailwind, shadcn, pnpm, Turborepo,
Postgres, Prisma, Redis, Auth.js, Zod, TanStack Query,
Cloudflare Workers/Queues/Cron/R2/Turnstile, Resend,
Sentry, Vitest, Playwright, Docker, GitHub Actions.

## Critical rules

- Organization is the tenant.
- Every protected organization-owned operation must be tenant-scoped.
- Authorization happens server-side.
- Never trust client-supplied ownership/role claims.
- Validate untrusted input with Zod.
- PostgreSQL is the source of truth.
- Redis is temporary/cache/idempotency infrastructure only.
- Keep business logic outside React components.
- Prefer Server Components unless client interactivity is required.
- Reuse shared packages/components before creating duplicates.
- Do not add dependencies or abstractions without a real need.
- Introduce infrastructure only when the corresponding feature requires it.

## UI

- Reuse packages/ui.
- Do not create one-off Button/Input/Dialog/etc. implementations.
- Follow docs/design-system.md.
- Handle loading, empty, error and success states.
- Maintain accessibility and responsive behavior.

## Background work

- Use Queues for slow/retryable external side effects.
- Queue consumers must tolerate retries/duplicates.
- Use Cron only for real scheduled work.
- Keep Cron jobs bounded; enqueue larger workloads.

## Observability

- Use structured logging.
- Preserve request/correlation IDs where useful.
- Use Sentry for unexpected production errors.
- Never log secrets.

## Testing

- Vitest: permissions, tenant isolation, business rules,
  webhook signing/idempotency and other high-risk logic.
- Playwright: critical end-to-end journeys.
- Do not test every trivial UI detail.

## Workflow

Before editing:

1. Inspect existing implementation.
2. Read relevant docs.
3. Reuse existing patterns.

Before completion, run applicable:

- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- E2E/Cloudflare preview when relevant

Never claim checks passed unless they were actually run.

## Scope

Aurbit V1 = bug intake + company triage + production engineering.
Do not turn it into a full Jira/project-management product.

## Implementation discipline

Aurbit must be built according to the documented project scope and build order.

Do not add setup, infrastructure, packages, abstractions, routes, components, database models, background jobs, or configuration unless they are required by the current implementation stage or an already-approved feature.

Follow these rules:

- Read `docs/product.md` and the current build stage before implementing.
- Implement only the requested feature or the minimum supporting work required for it.
- Do not pre-build future features.
- Do not create placeholder systems "for later."
- Do not add unused dependencies.
- Do not add unused environment variables.
- Do not create unused packages, folders, helpers, components, routes, tables, or config files.
- Do not leave dead code, commented-out code, abandoned experiments, unused exports, or temporary debug code.
- Do not introduce infrastructure before the project reaches the stage where it is actually needed.
- Do not silently expand the scope of a task.
- Do not add "nice to have" features unless explicitly requested.
- Do not create duplicate implementations when an existing pattern can be reused.
- Remove obsolete code when replacing an implementation.
- Keep the repository compiling cleanly with no avoidable lint/type errors or unused-code warnings.

When a requested change appears to require additional architecture or infrastructure that is not yet part of the current project stage, explain the dependency before adding it.

Prefer the smallest complete production-safe implementation that satisfies the documented requirement.

## No speculative production setup

"Production-grade" does not mean configuring every production technology upfront.

Use the documented build order.

Examples:

- Do not configure R2 before attachment uploads are being implemented.
- Do not configure Queues/Workers before asynchronous work exists.
- Do not configure Cron before scheduled work exists.
- Do not create webhook delivery infrastructure before webhooks are being implemented.
- Do not create PWA/service-worker setup before the core application is complete.
- Do not create production Docker images unless the current build stage calls for them.

## Code cleanliness

Before completing a task:

- Do not leave unused/dead/commented-out/debug code.
- Do not add unused files, dependencies, exports, or configuration.
- Remove obsolete code introduced or replaced by the current change.
- Run only the checks relevant to the change.
- Do not claim completion with known errors.
