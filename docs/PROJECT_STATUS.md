# Reviva Project Status

Report date: 2026-07-20

Status: Active Development

This document is the single source of truth for milestone completion. The
delivery sequence is described in `LAUNCH_ROADMAP.md`; release evidence remains
in `LAUNCH_READINESS_CHECKLIST.md`.

---

## Executive Summary

REV-001 through REV-011B are complete. ADR-004 through ADR-006 are accepted.
REV-011C is Ready to Start. Reviva has a verified web,
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
- Internal packages: `@reviva/domain`, `@reviva/auth`, `@reviva/postgres`, and
  `@reviva/conversation`
- Database workspace: `supabase/`
- Migration count: four
- Hosted PostgreSQL integration tests: 16 passing
- Hosted Auth integration test: passing
- REV-011A architecture: Complete
- ADR-004, ADR-005, and ADR-006: Accepted
- REV-011B conversation domain: Complete
- REV-011C capability authorization and tool registry: Ready to Start

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
normative architecture policy. Architecture acceptance did not imply runtime
completion. REV-011B subsequently implemented the pure conversation package;
no conversation persistence, migration, provider integration, tool execution,
background worker, API endpoint, or chat UI has been created.

Design documents are maintained under `docs/conversation/`.

### REV-011B — Conversation Domain and Deterministic State Machine

- `@reviva/conversation` implements opaque identifiers, actors/participants,
  aggregate projection, booking/reactivation/handoff state, typed commands,
  immutable events, pure transition handling, event application, replay,
  expected-version concurrency, duplicate contracts, policies, and failures.
- Deterministic in-memory tests cover every top-level state, booking confirmation
  and cancellation policy, handoff ownership, stale actions, replay integrity,
  and concurrency. The milestone passed CTO technical review and is Complete.
- No persistence, migration, provider, tool runtime, API, UI, environment, or
  external side effect is part of REV-011B.

## Current Work

### REV-011C — Capability Authorization and Tool Registry (Ready to Start)

- The milestone is authorized as the next starting point only; no REV-011C
  source implementation exists yet.
- It requires a separate execution order and acceptance gate.

## Future Milestones

### REV-011C through REV-011G — Remaining conversational core implementation

- Text-first orchestration, deterministic state, safe behavior, evaluation,
  traces, latency, cost, and quality metrics.
- REV-011C through REV-011G remain unimplemented. Each phase requires its own
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

Begin REV-011C only under its separate execution order. No REV-011C source
implementation was started while closing REV-011B.
