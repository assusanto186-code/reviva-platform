# REV-011 Implementation Sequence

Status: accepted architecture sequence; no implementation phase is authorized by this document

Each phase requires a separate CTO execution order. A later phase MUST NOT hide
unfinished acceptance criteria from an earlier phase.

## REV-011B — Conversation Domain and State Machine

Scope: introduce minimal pure contracts for conversation aggregate, immutable
commands/events, states, expected version, and typed failures.

Prerequisites: accepted ADR-004 and approved state-machine vocabulary. These
architecture prerequisites are satisfied; implementation still requires its
separate CTO execution order and clean precondition gate.

Outputs: dependency-free/pure package, deterministic reducer/command handlers,
event contracts, state replay tests.

Tests: every valid/invalid transition, terminal/reopen, intent-progress,
handoff-state, version conflict, deterministic IDs/time.

Non-goals: database, provider, tool execution, API, UI.

Acceptance: pure tests prove model text cannot set state and every accepted
command emits a deterministic event/outcome.

## REV-011C — Capability Authorization and Tool Registry

Scope: principal binding contract, permission/capability evaluator, AI
delegation grants, confirmation/approval evidence, closed versioned tool
registry and policy decisions.

Prerequisites: REV-011B and accepted ADR-005. Product-sensitive architecture
policy is fixed; implementation configuration must be supplied where required.

Outputs: application policy contracts, registry definitions, effect digest,
authorization decision events, fake tools.

Tests: actor/capability matrix, tenant/location/resource scope, stale grants,
all tool classes/failures, confirmation and approval races.

Non-goals: live tools, booking provider, outbox, model SDK.

Acceptance: no command or tool proposal can pass using TenantContext alone; AI
authority is demonstrably narrower than global/staff policy.

## REV-011D — Persistence, Immutable Events, Idempotency, and Outbox

Scope: reviewed migrations and PostgreSQL adapters for aggregate projection,
messages/events, authorization evidence, usage reservations, idempotency, and
outbox lifecycle.

Prerequisites: REV-011B/C, accepted ADR-006, configured retention within pending
legal/privacy durations, accepted pagination contract, and clean
migration-rebuild gate.

Outputs: forced-RLS schema/adapters, cursor queries, expected-version writes,
worker-independent outbox contracts and recovery operations.

Tests: two-tenant RLS, atomic projection/event/audit/outbox, concurrency,
dedupe, lease/retry/dead-letter/reconciliation, append immutability, cleanup.

Non-goals: running background worker or external effect.

Acceptance: hosted Development verification passes and existing REV-009/010
gates remain green.

## REV-011E — Provider Adapter and Structured-output Runtime

Scope: one provider adapter behind `AIProviderPort`, deterministic fake,
structured schema validation, prompt/policy bundles, budget reservation and
usage settlement.

Prerequisites: REV-011B–D, provider/model evaluation, configured values for both
mandatory cost ceilings, and an approved evaluation baseline.

Outputs: server-only adapter, cancellation/deadline handling, metadata
translation, safe invalid-output fallback.

Tests: provider contract, fake provider, malformed/hostile output, retry,
cancellation, usage, prompt snapshots/evaluations, sandbox compatibility.

Non-goals: autonomous live tool effects, multi-provider fallback, voice.

Acceptance: provider-native types do not cross adapter; structured proposals
cannot bypass state/capability/tool policy.

## REV-011F — Human Handoff and Web/API Integration

Scope: handoff orchestration, authenticated conversation endpoints, client
rendering boundary, safe text streaming and cancellation.

Prerequisites: REV-011B–E and implementation configuration for queue routing,
staffing, ownership, and the accepted provisional SLA defaults.

Outputs: server-side use-case composition, handoff queue adapter, route-level
error contracts, minimal text conversation delivery.

Tests: authenticated E2E, ownership races, continued patient messages, no-human
timeout, stale AI suppression, stream cancellation and reconnect.

Non-goals: voice, production booking, broad operator workspace.

Acceptance: human ownership always suppresses autonomous AI sends/effects and
browser input cannot establish tenant or capability.

## REV-011G — Evaluation, Safety Hardening, and Hosted Verification

Scope: adversarial evaluation, provider/tool sandbox, operational metrics,
budgets/rates, recovery exercises, security review.

Prerequisites: all prior phases and approved evaluation thresholds.

Outputs: recorded safety/business evaluation evidence, sandbox results,
observability and recovery runbooks, go/no-go recommendation for later product
milestones.

Tests: prompt injection, cross-tenant, tool misuse, hallucinated effect,
anomalous cost, provider outage, dead-letter recovery, hosted E2E.

Non-goals: REV-012 voice or REV-013 production controlled actions.

Acceptance: all gates pass with no unresolved High/Critical conversational
finding and CTO approves next milestone.

## Cross-phase Rules

- No phase may introduce real patient data.
- New migrations remain forward-only, forced-RLS, tenant-indexed, and hosted
  verified.
- Provider/tool/environment variables are introduced only in their authorized
  implementation phase with safe examples and classification.
- Every phase updates project status only after objective evidence.
- No production external side effect is enabled during REV-011.
