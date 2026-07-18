# Reviva Project Status

Report date: 2026-07-18

Status: Active Development

This document is the single source of truth for milestone completion. The
delivery sequence is described in `LAUNCH_ROADMAP.md`; release evidence remains
in `LAUNCH_READINESS_CHECKLIST.md`.

---

## Executive Summary

REV-001 through REV-011A are complete. ADR-004 through ADR-006 are accepted;
REV-011B production implementation is ready for its separately authorized
execution and has not started. Reviva has a verified web,
tenant, PostgreSQL, and authentication foundation, but it is not yet a
conversational AI Employee or a production-ready public product.

Repository completion and public-launch readiness are different gates. External
domain, legal, monitoring, recovery, and production evidence remain launch work
under REV-015 through REV-017; they do not reopen completed foundation
milestones.

## Repository State

- Repository: `C:\Users\hp\reviva-platform`
- Branch: `main`
- Application: `apps/web`
- Internal packages: `@reviva/domain`, `@reviva/auth`, and `@reviva/postgres`
- Database workspace: `supabase/`
- Migration count: four
- Hosted PostgreSQL integration tests: 16 passing
- Hosted Auth integration test: passing
- REV-011A architecture: Complete
- ADR-004, ADR-005, and ADR-006: Accepted
- REV-011B production implementation: Ready to Start; not started

## Completed Milestones

### REV-001 — Platform repository foundation

- pnpm workspace, Turborepo tasks, and application/package/service boundaries.

### REV-002 — Reviva web identity

- Next.js App Router application and initial Reviva product identity.

### REV-003 — Brand system

- Semantic visual, interaction, accessibility, and product-language standards.

### REV-004 — Engineering standards

- Architecture, coding, security, Git, quality-gate, and definition-of-done
  rules.

### REV-005 — Brand-aligned UI primitives

- Reusable button, badge, card, input, and container primitives.

### REV-006 — Landing Page Foundation

- Responsive, accessible public landing page with honest product positioning
  and early-access navigation.

### REV-007 — AI Employee product contract

- Capability model, phased delivery framework, safety boundaries, and release
  evidence checklist.

### REV-008 — Publishable web and lead capture

- Validated early-access form, consent and patient-data warning, spam and
  request controls, authenticated webhook boundary, legal routes, metadata,
  publishing runbook, and Vercel production tutorial.
- The repository milestone is complete. Live-domain, production delivery,
  legal approval, distributed abuse protection, monitoring, and rollback
  evidence remain release gates for REV-015 through REV-017.

### REV-009 — Tenant and knowledge foundation

- Dependency-free domain contracts for tenants, memberships, knowledge
  lifecycle, repositories, and audit events.
- Four ordered PostgreSQL migrations define the tenant schema, restricted
  `reviva_app` role, forced RLS, tenant context, immutable knowledge history,
  append-only audit behavior, and restricted Auth identity resolution.
- `@reviva/postgres` supplies transactional repository adapters, optimistic
  locking, typed persistence errors, and fail-closed Development guards.
- Four migrations are synchronized with Supabase Development. Remote database
  lint is clean and all 16 hosted PostgreSQL integration tests pass.

### REV-010 — Authentication and trusted tenant context

- `@reviva/auth` defines vendor-independent session, identity, redirect, and
  trusted-context boundaries.
- `apps/web` implements Supabase SSR clients, Next.js Proxy refresh, `/login`,
  `/auth/callback`, protected `/app`, controlled inactive/unprovisioned states,
  and logout.
- Hosted verification proves Supabase password authentication, live `getUser`
  validation, Reviva identity and active-membership resolution, trusted
  `TenantContext` creation, restricted RLS-backed access, and local session
  invalidation on logout.
- The hosted verification is an integration test of Supabase and Reviva service
  boundaries; it is not a browser or HTTP end-to-end test of the Next.js routes.

### REV-011A — Conversation Architecture

REV-011A is an architecture-first documentation milestone. It defines the
conversation aggregate, deterministic state machine, authenticated principal
and capability model, closed tool registry, provider abstraction, immutable
message/event semantics, concurrency, transaction/outbox/idempotency, knowledge
provenance, prompt/policy versioning, human handoff, safety, audit retention,
failure taxonomy, testing, and staged implementation sequence.

ADR-004 through ADR-006 are Accepted. All twelve CTO decision areas are
normative architecture policy. Architecture acceptance does not imply runtime
completion: no conversation package, source implementation, migration, provider
integration, tool execution, background worker, API endpoint, or chat UI has
been created.

Design documents are maintained under `docs/conversation/`.

## Current Work

No implementation milestone is currently In Progress. REV-011B is Ready to
Start only through its separate CTO execution order and clean precondition
gate; it has not started.

## Future Milestones

### REV-011B through REV-011G — Conversational core implementation

- Text-first orchestration, deterministic state, safe behavior, evaluation,
  traces, latency, cost, and quality metrics.
- REV-011B through REV-011G remain unimplemented. Each phase requires its own
  execution order and acceptance gate.

### REV-012 — Voice and character runtime

- Real-time speech, interruption, disclosure, consent, voice configuration, and
  character evaluation.

### REV-013 — Controlled actions

- Tenant-aware, authorized, idempotent, and auditable front-desk actions.

### REV-014 — Human operations

- Operator inbox, handoff, takeover, assignment, resolution, and quality review.

### REV-015 — Security and reliability readiness

- Threat model, privacy, retention, recovery, monitoring, service objectives,
  provider outage, and incident controls.

### REV-016 — Design-partner pilot

- Approved tenant configuration, controlled rollout, measured quality,
  operational learning, and customer sign-off.

### REV-017 — Production launch

- Go/no-go approval, staged release, production support, rollback readiness,
  incident response, and post-launch quality cadence.

## Next Authorized Step

Run the separately authorized REV-011B precondition gate from a clean,
synchronized repository. No REV-011B code, schema, package, provider, tool,
endpoint, or UI work has started.
