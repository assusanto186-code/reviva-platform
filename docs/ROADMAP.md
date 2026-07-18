# Reviva Engineering Roadmap

Version: 1.1

Status: Active

Owner: Reviva Engineering

Last reviewed: 2026-07-18

## Source of Truth

Milestone status is maintained only in
[`PROJECT_STATUS.md`](./PROJECT_STATUS.md). The detailed delivery sequence is in
[`LAUNCH_ROADMAP.md`](./LAUNCH_ROADMAP.md), and release evidence is in
[`LAUNCH_READINESS_CHECKLIST.md`](./LAUNCH_READINESS_CHECKLIST.md).

## Current Repository State

REV-001 through REV-010 are complete. No product implementation milestone is
currently active, and REV-011 has not started.

Completed engineering foundations include:

- pnpm/Turborepo workspace and Next.js web application;
- brand, engineering, product, and launch contracts;
- publishable web and lead-capture repository implementation;
- dependency-free tenant and knowledge domain contracts;
- four synchronized PostgreSQL migrations, restricted runtime access, forced
  RLS, immutable history, and transactional persistence;
- Supabase authentication, restricted identity resolution, trusted
  `TenantContext`, protected application shell, and logout;
- passing local, hosted PostgreSQL, and hosted Auth verification.

## Next Planned Milestone

REV-011 is the next planned product milestone. Architecture design and
implementation require a separate CTO execution order. REV-010.5A changes
documentation only and does not begin REV-011.

The remaining sequence is:

1. REV-011 — Conversational core.
2. REV-012 — Voice and character runtime.
3. REV-013 — Controlled actions.
4. REV-014 — Human operations.
5. REV-015 — Security and reliability readiness.
6. REV-016 — Design-partner pilot.
7. REV-017 — Production launch.

## External Launch Inputs

Production domain activation, Vercel ownership, durable lead delivery, legal
approval, monitoring, recovery evidence, and operational ownership remain
release inputs. They are tracked as launch readiness and REV-015 through
REV-017 work; they do not change the completed status of REV-001 through
REV-010.

Only fake or demonstration data is permitted before the appropriate privacy,
security, and pilot approvals.

## Quality Gate

Every implementation change must pass the relevant root lint, build, tests,
`git diff --check`, and security/artifact checks. Persistence changes also
require linked database lint, migration synchronization, and hosted isolation
tests. Authentication changes require hosted Auth verification.
