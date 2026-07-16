# Reviva Engineering Roadmap

Version: 1.0

Status: Active

Owner: Reviva Engineering

Last reviewed: 2026-07-16

## Source of Truth

Detailed product milestones and release state are maintained in
[`LAUNCH_ROADMAP.md`](./LAUNCH_ROADMAP.md). Evidence is maintained in
[`LAUNCH_READINESS_CHECKLIST.md`](./LAUNCH_READINESS_CHECKLIST.md). This file
defines the engineering sequence and gates.

## Current Milestone: REV-009

Completed:

- vendor-independent domain models and repository contracts;
- tenant-aware in-memory test doubles;
- knowledge draft, publish, supersede, and rollback rules;
- local tenant isolation, permission, lifecycle, and audit tests;
- authentication, database, and tenant-isolation ADRs;
- Supabase Auth, PostgreSQL, Storage, Vercel, and Next.js stack approval.

Required before REV-010:

1. Add versioned PostgreSQL migrations and restricted roles.
2. Implement a tenant-bound transaction coordinator.
3. Implement production repository adapters behind existing interfaces.
4. Add optimistic concurrency for stale operator writes.
5. Run shared conformance, isolation, concurrency, audit, and rollback tests
   against disposable PostgreSQL.
6. Implement membership-derived `TenantContext` through Supabase Auth.
7. Deploy `apps/web` to a generated Vercel Preview URL for internal QA.
8. Record build, environment, browser, log, and rollback evidence.

## External Inputs

- non-production Supabase project and credential owners;
- Vercel project/team access;
- GitHub-to-Vercel integration approval;
- operational ownership for Preview logs and rollback.

No production domain purchase is required for REV-009. Preview uses the
generated `*.vercel.app` address. Only fake/demo data is permitted.

## Production Gate

Every commit must pass root lint, root build, domain tests, `git diff --check`,
zero ESLint problems, and a repository-wide scan with no unresolved work
markers. Persistence changes additionally require disposable database migration
and isolation tests.

REV-010 cannot begin while any REV-009 persistence, isolation, transaction,
audit, or Preview verification requirement is open.
