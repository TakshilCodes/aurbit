# Aurbit

Aurbit is a multi-tenant bug-reporting SaaS for companies.

It allows teams to embed a lightweight bug-reporting widget into their websites or products. Users can submit bug reports with screenshots and browser/page context, while company teams manage and triage reports through an authenticated dashboard.

> Status: Active development

## Core idea

Organization
→ Project
→ Bug Reports

Each organization can own multiple projects.

Aurbit has two main applications:

- `apps/web` — public website, hosted bug-report form, and embeddable reporting widget
- `apps/admin` — authenticated company dashboard for project management and bug triage

Production domains:

- `aurbit.takshil.in`
- `admin.aurbit.takshil.in`

## Planned V1 features

- Multi-tenant organizations and projects
- Embeddable bug-report widget
- Hosted bug-report form
- Screenshot and attachment uploads
- Automatic browser/page context capture
- Bug status and priority management
- Team assignment and internal notes
- Webhook delivery
- Background processing with Cloudflare Queues
- Audit logging
- Production monitoring and testing

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Turborepo
- pnpm
- PostgreSQL
- Prisma
- Redis
- Auth.js
- TanStack Query
- Zod
- Cloudflare Workers
- Cloudflare Queues
- Cloudflare R2
- Cloudflare Cron
- GitHub Actions
- Vitest
- Playwright
- Sentry

Some infrastructure is intentionally added only when the corresponding feature is implemented.
