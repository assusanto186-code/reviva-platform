# Reviva Project Status

Report date: 2026-07-29

Status: Active Development

This document is the single source of truth for milestone completion. The
delivery sequence is described in `LAUNCH_ROADMAP.md`; release evidence remains
in `LAUNCH_READINESS_CHECKLIST.md`.

---

## Executive Summary

REV-001 through REV-011F are complete. ADR-004 through ADR-006 are accepted.
REV-011C's deterministic authorization evaluator and closed, non-executing
tool registry passed the complete local and hosted quality gate. REV-011D is
Complete with provider-independent reliable-persistence contracts and an
in-memory reference implementation. REV-011E is Complete with a
  provider-independent execution engine, structured-output validation, bounded
  retry/repair/fallback, reconciliation contracts, mandatory budgets, and
  data-only tool proposals. REV-011F is Complete with a provider-independent
  Tool Runtime, closed handlers, transactional application coordination, and
  a controlled human-handoff lifecycle. The Release Candidate is Ready to
  Start, but its implementation has not started.
  Reviva has a verified web,
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
- Internal packages: `@reviva/domain`, `@reviva/auth`, `@reviva/postgres`,
  `@reviva/conversation`, `@reviva/execution`, and `@reviva/runtime`
- Database workspace: `supabase/`
- Migration count: four
- Hosted PostgreSQL integration tests: 16 passing
- Hosted Auth integration test: passing
- REV-011A architecture: Complete
- ADR-004, ADR-005, and ADR-006: Accepted
- REV-011B conversation domain: Complete
- REV-011C capability authorization and tool registry: Complete
- REV-011D persistence contracts and reference adapter: Complete
- REV-011E provider-independent execution engine: Complete
- REV-011F tool runtime, handoff, and application integration: Complete
- Release Candidate: Ready to Start; implementation not started

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

### REV-011C — Capability Authorization and Tool Registry

- `@reviva/conversation` now owns one canonical capability vocabulary,
  immutable capability sets, typed authority facts, deny-by-default decisions,
  authority intersection, confirmation/approval/handoff/reactivation policy,
  and a closed immutable tool registry.
- Registry descriptors contain no execution handler. Unknown tools, duplicate
  identifiers/names, invalid capability references, provider-specific fields,
  and executable fields fail deterministically.
- The implementation is pure and in memory. It performs no tool execution,
  persistence, provider call, environment read, network call, or external side
  effect.
- All deterministic package gates, root quality gates, hosted Auth integration,
  hosted PostgreSQL integration, database lint, and migration synchronization
  passed. Production role-to-capability mapping remains pending trusted
  application integration.

## Completed Milestone Detail

### REV-011D — Persistence, Immutable Events, Idempotency, and Outbox (Complete)

- `@reviva/conversation` defines tenant-scoped event, projection, snapshot,
  idempotency, transaction, outbox, audit, and persistence-mapping contracts.
- A deterministic copy-on-write in-memory reference adapter verifies
  append-only history, optimistic concurrency, atomic commit/rollback,
  duplicate-safe idempotency, validated outbox transitions, audit immutability,
  and tenant isolation.
- Event streams remain authoritative. Projections are rebuildable and snapshots
  are optional; full replay and snapshot-assisted replay converge.
- The adapter is test/reference-only: it is not durable or multi-process safe.
  No migration, production database adapter, outbox worker, provider
  integration, tool execution, endpoint, or UI is part of REV-011D.

### REV-011E — Execution Engine and AI Provider Abstraction (Complete)

- `@reviva/execution` implements a provider-independent orchestrator with
  trusted immutable requests, closed execution purposes, explicit
  provider/model policy, typed results/failures, and mandatory token, attempt,
  fallback, repair, context, tool-proposal, and cost ceilings.
- Versioned planner output is validated exactly. One repair and at most two
  provider retries are separate budgets; fallback order is explicit and
  uncertain accepted outcomes require reconciliation.
- The engine returns data-only `ToolProposal` objects after closed-registry,
  capability, actor, confirmation, and approval validation. It never executes
  a tool or mutates/persists conversation state.
- Deterministic scripted providers are test/reference-only. No real provider
  SDK, network inference, environment configuration, migration, endpoint,
  worker, UI, or REV-011F implementation is included.
- Production composition-root configuration, real provider adapters, provider
  evaluations, and prompt bundles remain pending.
- The source and hosted quality gates passed, CTO approval was recorded, and
  REV-011E is Complete.

### REV-011F — Tool Runtime, Human Handoff, and Application Integration

- `@reviva/runtime` now implements trusted immutable runtime requests, a closed
  executable registry, authorization/confirmation/approval revalidation,
  explicit transaction ownership, idempotent result replay, execution records,
  deferred outbox effects, normalized continuation, and controlled handoff.
- Deterministic reference persistence and booking handlers are test-only. No
  production gateway, worker, database adapter, endpoint, UI, provider SDK,
  network effect, environment variable, or migration was added.
- The 65-test package suite and complete source and hosted gates are green.
  CTO approval is recorded and REV-011F is Complete.
- AUD-005 remains open because no installed/configured real browser/HTTP harness
  exists; hosted Auth coverage is not relabeled as browser E2E.

## Current Milestone

### Release Candidate — Ready to Start

- Release Candidate implementation has not started and requires a separate
  execution order.
- An Execution Transcript is planned for the Release Candidate.
- Real AI providers, booking and messaging providers, and the production
  outbox worker remain deferred.
- AUD-005 remains open pending real browser/HTTP evidence.

## Future Milestones

### REV-011G — Conversational evaluation and hardening

- Adversarial evaluation, provider/tool sandbox verification, operational
  metrics, budgets/rates, recovery exercises, and security review.

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

Begin Release Candidate work only under a separate approved execution order.
REV-011A through REV-011F are Complete, the Release Candidate is Ready to
Start but has not started, its Execution Transcript is planned, and AUD-005
remains open until independently proven closed.
