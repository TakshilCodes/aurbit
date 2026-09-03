# Aurbit Product Specification

## Overview

Aurbit is a multi-tenant bug-reporting SaaS for companies that want to collect bug reports directly from their websites or applications and manage those reports from a central dashboard.

A company creates an organization, creates one or more projects inside that organization, and installs a small Aurbit widget on each product.

The widget displays a customizable **Report a bug** button. When a visitor clicks it, an Aurbit-hosted report form opens inside a modal/iframe.

The reporter can submit a bug with a title, description, optional email address, screenshot/attachment, and useful browser/page context.

The company's team then reviews, prioritizes, assigns, resolves, and manages those reports inside the Aurbit dashboard.

Aurbit V1 focuses on:

- bug intake
- organization/project management
- report triage
- widget customization
- multi-tenancy and RBAC
- webhooks and notifications
- production engineering

Aurbit should not become a full Jira-like project-management system in V1.

---

# Product Model

The core ownership model is:

```text
User
  ↓
Organization
  ↓
Project
  ↓
Bug Report
```

The **Organization is the tenant**.

One organization may own multiple projects.

Example:

```text
Acme

├── Marketing Website
├── Customer Dashboard
└── Mobile App
```

Each project has:

- its own public project key
- its own widget configuration
- its own bug reports
- its own webhook configuration where applicable

Organization-owned data must never be accessible to users from another organization.

---

# Main User Types

## Reporter

A Reporter is a visitor or customer using a company's website or application.

A Reporter does not need an Aurbit account.

A Reporter can:

- open the Aurbit widget
- open a hosted report page
- submit a bug title
- submit a bug description
- optionally provide an email address
- upload a supported screenshot or attachment
- automatically provide useful page/browser context where appropriate

A Reporter does not receive a full issue-management dashboard in V1.

Reporter-facing functionality should remain simple.

The reporter's main goal is:

```text
I found a problem
↓
I can report it quickly
↓
I can continue using the product
```

---

## Organization Team Member

An Organization Team Member is a company employee or collaborator who uses the authenticated Aurbit dashboard.

Organization roles are:

### Owner

The Owner controls sensitive organization-level actions.

Examples may include:

- organization settings
- organization deletion
- member role changes
- sensitive team actions
- project management
- webhooks/integrations

The organization creator becomes the initial Owner.

### Admin

Admins can manage most operational Aurbit functionality where permitted.

Examples:

- projects
- bug reports
- assignments
- priorities
- statuses
- team operations
- widget settings
- webhooks

Admins should not automatically receive every Owner-only permission.

### Member

Members have more limited access.

Members may generally work with:

- projects they can access
- reports
- assignments
- internal report notes
- triage operations allowed by the permission model

Exact permissions should remain centralized and enforced server-side.

---

# Application Structure

Aurbit is split into two main Next.js applications.

## `apps/web`

`apps/web` contains public-facing Aurbit functionality.

Expected responsibilities:

- public Aurbit/landing pages
- hosted bug-report page
- embedded report form
- iframe/modal report experience
- `widget.js`
- public widget assets
- public widget configuration
- anonymous bug-report submission surfaces

Production domain:

```text
aurbit.takshil.in
```

---

## `apps/admin`

`apps/admin` is the authenticated company dashboard.

It is not primarily an internal super-admin application for the creator of Aurbit.

Expected responsibilities:

- organization dashboard
- workspace switching
- project management
- project switching
- report lists
- report details
- report triage
- team/member management
- widget customization
- webhook management
- organization settings
- project settings
- audit logs where applicable
- basic analytics

Production domain:

```text
admin.aurbit.takshil.in
```

---

# Company Onboarding Flow

The initial company flow is:

```text
User signs up
↓
Creates organization
↓
Becomes Organization Owner
↓
Creates first project
↓
Aurbit generates public project key
↓
User configures widget
↓
User copies embed code
↓
Company installs Aurbit on its product
```

Example widget installation:

```html
<script
  src="https://aurbit.takshil.in/widget.js"
  data-project="pk_proj_J8x2Kq"
></script>
```

The project key is public.

It identifies which project should receive a bug report.

It is not an admin credential or secret.

---

# Authentication and Account Management

Aurbit provides authentication for organization/team users.

V1 account functionality should include:

- signup
- login
- logout
- email verification
- password reset
- session management

Public bug reporters do not need an Aurbit account.

---

# Organizations

Users can create organizations/workspaces.

An organization should have at least:

- name
- unique slug
- optional logo
- settings
- members
- role assignments

A user may belong to multiple organizations.

Aurbit should support workspace switching.

Every organization-owned action must operate against the active organization and the authenticated user's membership in that organization.

---

# Organization Membership

Organizations contain members.

Membership connects:

```text
User
↕
OrganizationMember
↕
Organization
```

Membership stores the organization-scoped role.

Roles:

```text
OWNER
ADMIN
MEMBER
```

Team functionality should eventually include:

- invite member
- accept invitation
- list members
- change role
- remove member

Sensitive actions should remain Owner-only where appropriate.

---

# Projects

One organization can own multiple projects.

A project represents a product or application where bug reports are collected.

Examples:

- marketing website
- SaaS dashboard
- mobile application
- customer portal

A Project should include:

- organization relationship
- name
- public project key
- widget settings
- created/updated timestamps
- lifecycle state where appropriate

Company members should be able to:

- create projects
- edit projects
- view projects
- switch projects
- archive/delete projects where permitted
- copy the project's widget embed snippet

---

# Public Project Key

Each project has a generated public key.

Example:

```text
pk_proj_J8x2Kq
```

The key may be used by:

- the widget embed script
- hosted report links
- iframe/report pages
- safe public widget configuration endpoints

The key must never grant access to authenticated dashboard functionality.

Public reporting security should come from:

- server-side validation
- Turnstile
- rate limiting
- upload restrictions
- abuse prevention
- safe endpoint design

---

# Hosted Bug-Report Page

Every project should have a hosted bug-report page.

Conceptually:

```text
aurbit.takshil.in/report/[projectKey]
```

The form supports:

- title
- description
- optional reporter email
- screenshot/attachment where enabled
- automatically captured context where appropriate

Public reporters should be able to submit reports without creating an account.

---

# Embeddable Widget

Aurbit provides a small JavaScript widget.

Example:

```html
<script
  src="https://aurbit.takshil.in/widget.js"
  data-project="pk_proj_J8x2Kq"
></script>
```

Widget flow:

```text
Customer website loads widget.js
↓
Widget reads project key
↓
Widget fetches safe public configuration
↓
Widget renders Report a bug button
↓
Visitor clicks button
↓
Aurbit-hosted modal/iframe opens
↓
Report form appears
↓
Visitor submits report
```

The widget should remain small.

The main report interface remains hosted by Aurbit so it does not inherit arbitrary CSS or application logic from the customer's website.

---

# Widget Customization

Widget configuration is project-specific.

V1 customization should include:

- custom button label
- bottom-left or bottom-right position
- light theme
- dark theme
- system theme
- accent color
- border radius
- live preview
- copyable embed snippet

Widget configuration is stored in Aurbit.

This means a company can update its widget appearance from the dashboard without replacing the script already installed on its website.

---

# Bug Report Data

A bug report belongs to:

```text
Organization
↓
Project
↓
BugReport
```

A BugReport may contain:

- title
- description
- optional reporter email
- status
- priority
- assignee
- screenshots/attachments
- captured environment information
- page URL
- browser/user-agent information
- operating-system information where reasonably derivable
- viewport size
- created timestamp
- updated timestamp
- resolution timestamp where relevant
- internal activity/history

Bug-report metadata is stored in PostgreSQL.

Binary screenshots/attachments are stored in Cloudflare R2.

---

# Attachment Uploads

Reporters may attach supported screenshots/files.

Uploads must be restricted.

Validation should include:

- allowed file type
- maximum file size
- association with the correct project/report
- safe metadata handling

Attachments should be stored in Cloudflare R2.

PostgreSQL stores attachment metadata and ownership references.

Unrestricted arbitrary uploads are not part of the product.

---

# Public Submission Flow

The expected bug-submission flow is:

```text
Reporter fills form
↓
Aurbit validates project key
↓
Aurbit validates form input
↓
Turnstile/rate-limit checks
↓
Attachment upload → Cloudflare R2
↓
Bug report metadata → PostgreSQL
↓
Background event/job created
↓
Cloudflare Queue
↓
Worker handles asynchronous side effects
↓
Company sees report in dashboard
```

Potential asynchronous actions include:

- notify company members
- send `bug.created` webhook
- additional lightweight background processing

The main submission response should not be unnecessarily blocked by slow external side effects.

---

# Automatically Captured Context

Where reasonably available, Aurbit may capture:

- embedding page URL
- browser/user-agent
- operating-system information
- viewport size

This context exists to help company teams reproduce reported problems.

Do not collect unnecessary information.

---

# Company Dashboard

The organization dashboard should provide a quick overview of reports and projects.

Initial information may include:

- project count
- open report count
- resolved report count
- reports by status
- reports by priority
- recent reports

Deep BI/analytics are not required for V1.

---

# Reports List

Company members can view reports scoped to their active organization/project.

The reports list should support:

- search
- filtering
- sorting
- pagination
- project filtering
- status filtering
- priority filtering

The interface must include appropriate:

- loading states
- empty states
- error states
- retry behavior where useful

---

# Report Detail

A report detail page should show:

- title
- description
- screenshot/attachment
- reporter email where provided
- captured environment information
- page URL
- browser information
- timestamps
- status
- priority
- assignee
- internal notes/activity

Only properly authorized organization members may access report-management data.

---

# Report Status

V1 statuses are:

```text
OPEN
IN_PROGRESS
RESOLVED
CLOSED
```

Typical lifecycle:

```text
OPEN
↓
IN_PROGRESS
↓
RESOLVED
↓
CLOSED
```

The product should not assume every report must follow a rigid workflow if business rules later require flexibility.

Status changes are primarily for the internal company team.

---

# Report Priority

V1 priority levels are:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Priority helps the organization triage work.

Priority is an internal company-management field and does not turn the Reporter experience into a project-management workflow.

---

# Report Assignment

A report may be assigned to an organization member.

The assignee must belong to the same organization.

Assignments should be authorization-checked server-side.

---

# Internal Notes

Organization team members can add internal notes/comments to reports.

Internal notes:

- are not public reporter comments
- are intended for company collaboration
- must remain organization scoped

A full realtime collaboration system is not required in V1.

---

# Reporter Communication

Reporter email is optional.

If a Reporter provides an email, Aurbit may send status/resolution updates.

Example:

```text
Report submitted
↓
Company resolves report
↓
Optional resolution email
```

This does not require creating a Reporter account.

---

# Basic Analytics

Aurbit should provide useful basic operational analytics.

Examples:

- total reports
- open reports
- resolved reports
- reports by status
- reports by priority
- reports by project

Deep analytics, custom reports, BI tooling, and advanced trend dashboards are outside the V1 requirement.

---

# Multi-Tenancy

Multi-tenancy is a core product requirement.

Every organization-owned resource must be isolated.

Typical relationships:

```text
Organization
├── OrganizationMember
├── Project
│   ├── BugReport
│   │   └── Attachment
│   └── WebhookEndpoint
└── AuditLog
```

Important product rules:

- every Project belongs to one Organization
- every BugReport belongs to one Project and Organization
- organization members can access only organizations they belong to
- protected actions must be organization scoped
- public project keys do not bypass authorization
- cross-tenant access must be prevented

---

# Webhooks

Aurbit supports outgoing webhooks.

Webhooks send Aurbit events to systems controlled by the customer.

Remember:

```text
Widget
→ data comes INTO Aurbit

Webhook
→ data/events go OUT OF Aurbit
```

Initial webhook events:

```text
bug.created
bug.updated
bug.resolved
```

Example uses:

- create an issue in another internal system
- notify another company service
- sync report lifecycle state
- power custom integrations

---

# Webhook Configuration

Organizations/projects should be able to register webhook endpoints.

Webhook configuration may include:

- endpoint URL
- enabled/disabled status
- subscribed event types
- signing secret

Webhook delivery should eventually include:

- unique event ID
- signed HTTP request
- delivery record
- delivery attempt records
- response status
- failure information
- retry/backoff
- manual retry where useful

Webhook reliability matters because customer systems may temporarily fail.

---

# Webhook Delivery Flow

Expected flow:

```text
Aurbit event occurs
↓
Webhook event created
↓
Cloudflare Queue
↓
Worker consumes event
↓
Signed HTTP POST
↓
Customer webhook endpoint
↓
2xx response?
├── yes → Delivered
└── no → Retry/backoff
         ↓
       Failed if retries exhausted
```

Webhook consumers may receive retries.

Events should therefore support idempotency.

---

# Background Jobs

Cloudflare Queues are used for asynchronous work.

Initial background work may include:

- company notification emails
- webhook deliveries
- maintenance tasks

Queue consumers run in Cloudflare Workers.

Background jobs should not be introduced solely for architecture complexity.

They should solve real asynchronous/retryable work.

---

# Email

Aurbit uses transactional email for flows such as:

- team invitation
- email verification
- password reset
- new report notification
- optional reporter resolution/update email

Resend is the email provider.

Email operations may be moved to background queues when appropriate.

---

# Scheduled Work

Cloudflare Cron Triggers are used only when scheduled tasks exist.

Potential V1 uses:

- stale temporary-upload cleanup
- abandoned data cleanup
- reconciliation
- small analytics aggregation

Large scheduled workloads should enqueue work rather than processing an unbounded amount directly inside the Cron execution.

---

# Redis

Redis is used only for temporary/cacheable concerns.

Potential uses include:

- rate limiting
- short-lived public widget configuration caching
- idempotency
- temporary coordination

Redis is not the source of truth for durable Aurbit business data.

---

# Public Abuse Protection

Anonymous reporting surfaces require abuse protection.

Aurbit should use mechanisms such as:

- Cloudflare Turnstile
- rate limiting
- file restrictions
- server-side validation

Public reporting should remain easy for legitimate reporters while preventing obvious automated abuse.

---

# Audit Logs

Aurbit should record sensitive organization activity.

Potential audit events:

- role changes
- member removal
- project deletion
- sensitive organization settings updates
- important report-management actions

Audit logging exists for accountability and security.

It is separate from application debugging logs.

---

# Observability

Aurbit should include production observability.

The product uses:

- structured logging
- request/correlation IDs
- Sentry

Observability should help answer questions such as:

```text
What operation failed?
Which request caused it?
Which organization/project/report was involved?
Did the failure occur in HTTP handling or background processing?
```

Sensitive information must not be unnecessarily logged.

---

# Testing Requirements

Testing should focus on high-risk business behavior.

## Vitest

Important areas include:

- organization permissions
- role rules
- tenant isolation
- report state transitions
- webhook signing
- webhook idempotency
- validation
- other important business logic

## Playwright

Critical end-to-end journeys include:

- organization creation
- project creation
- hosted report submission
- widget report submission
- attachment upload
- report triage
- RBAC denial
- cross-tenant isolation

Aurbit does not need tests for every trivial UI detail.

---

# Frontend and UX Expectations

The dashboard and reporting experience should be production-quality.

Requirements include:

- mobile responsiveness
- accessible form controls
- keyboard-friendly interactions
- consistent loading states
- consistent empty states
- consistent error states
- retry behavior where useful
- predictable navigation
- clear hierarchy

The widget/report iframe should work across different customer websites without relying on the host application's CSS.

---

# Design System Direction

Aurbit should use a consistent reusable design system.

The goal is to achieve the maturity and consistency associated with well-engineered product design systems such as Razorpay Blade, without directly copying Razorpay's branding or exact component design.

Detailed UI rules belong in:

```text
docs/design-system.md
```

The application should prefer shared components and design tokens rather than creating visually inconsistent page-specific implementations.

---

# PWA

Aurbit may provide basic PWA functionality for the company dashboard after the core product is working.

V1 PWA scope:

- manifest
- installability
- service worker
- static asset caching
- offline fallback
- new-version update prompt

Aurbit should not implement offline-first CRUD or complex offline synchronization in V1.

---

# Production Environments

Aurbit should conceptually support:

```text
Local
Preview / Staging
Production
```

Development/staging infrastructure should remain separated from production infrastructure where appropriate.

Examples include:

- PostgreSQL
- Redis
- R2 buckets
- Queues
- Worker secrets

---

# Deployment Model

Aurbit remains one GitHub repository and one Turborepo.

Applications are deployed independently.

```text
apps/web
→ Vercel
→ aurbit.takshil.in
```

```text
apps/admin
→ separate Vercel project
→ admin.aurbit.takshil.in
```

Background processing:

```text
Cloudflare Worker
├── Queue consumers
└── Cron Triggers
```

The background Worker does not require a public domain unless an intentional HTTP interface is added later.

---

# Core Production Technologies and Their Purpose

| Technology               | Aurbit responsibility                 |
| ------------------------ | ------------------------------------- |
| PostgreSQL               | durable application data              |
| Prisma                   | database access and migrations        |
| Redis                    | temporary/cache/idempotency concerns  |
| Cloudflare R2            | screenshots and attachments           |
| Cloudflare Queues        | asynchronous jobs                     |
| Vercel                   | Next.js hosting for web and admin     |
| Cloudflare Workers       | background Queue and Cron execution   |
| Cloudflare Cron Triggers | scheduled maintenance                 |
| Turnstile                | public-form abuse protection          |
| Resend                   | transactional email                   |
| TanStack Query           | dashboard server-state management     |
| Sentry                   | error monitoring                      |
| Structured logging       | production debugging                  |
| Vitest                   | business logic/integration testing    |
| Playwright               | critical end-to-end testing           |
| Docker                   | repeatable local dependencies/tooling |
| GitHub Actions           | CI/CD automation                      |

---

# V1 Feature Scope

## Required Core Product

- authentication/account management
- organization creation
- organization membership
- Owner/Admin/Member roles
- workspace switching
- projects
- public project keys
- hosted report page
- embeddable widget
- public bug submission
- screenshot/attachment upload
- captured browser/page context
- widget customization
- company report dashboard
- report search/filter/sort/pagination
- report detail
- status
- priority
- assignment
- internal notes
- basic analytics
- team management
- reporter resolution email where email exists
- multi-tenant authorization
- audit logging
- outgoing webhooks
- background jobs
- retry/failure handling
- scheduled maintenance
- rate limiting
- Turnstile
- production observability
- CI/CD
- production deployment
- critical automated testing

---

# Optional / Stretch Features

These should not block V1 completion:

- screen-recording attachments
- public reporter tracking link/token
- reporter accounts/dashboard
- browser push notifications
- realtime dashboard updates
- advanced realtime collaboration
- advanced analytics
- extensive widget customization
- large integration marketplace
- preset Slack integration
- preset Discord integration
- preset Jira integration
- preset Linear integration

Only add stretch features after the core product is complete and stable.

---

# Explicit Non-Goals for V1

Aurbit V1 is not intended to become:

- Jira
- Linear
- a full project-management platform
- a complete customer-support system
- a realtime collaboration suite
- an enterprise analytics platform
- a full public bug tracker
- an offline-first application
- a giant integration marketplace

The product should remain centered on:

```text
Collect bug reports
↓
Give companies useful context
↓
Help teams triage them
↓
Send useful events/integrations
```

---

# Product Success Criteria

Aurbit V1 can be considered successful when a company can complete this end-to-end flow:

```text
Company user signs up
↓
Creates organization
↓
Creates project
↓
Configures widget
↓
Copies script
↓
Installs widget on another website
↓
Reporter submits a bug
↓
Screenshot/context is stored correctly
↓
Company sees the report
↓
Team assigns priority/status/assignee
↓
Internal team collaborates
↓
Webhook/email background processing works
↓
Report is resolved
↓
Reporter can optionally receive resolution email
```

And the implementation preserves:

- tenant isolation
- server-side authorization
- input validation
- safe uploads
- reliable async processing
- useful observability
- meaningful testing
- deployability
- maintainable architecture

That complete flow is more important than adding large numbers of secondary features.
