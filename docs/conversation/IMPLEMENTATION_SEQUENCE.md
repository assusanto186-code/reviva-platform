# REV-011 Implementation Sequence

Status: accepted architecture sequence; no implementation phase is authorized by this document

Each phase requires a separate CTO execution order. A later phase MUST NOT hide
unfinished acceptance criteria from an earlier phase.

## REV-011B — Conversation Domain and State Machine

Implementation status: Complete.

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

Implementation status: Complete.

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

Implementation status: Complete.

Scope: provider-independent event, projection, snapshot, idempotency,
transaction, outbox, audit, and persistence-mapping contracts, plus a
deterministic in-memory reference adapter.

Prerequisites: completed REV-011B/C, accepted ADR-006, and a clean local
REV-011C checkpoint.

Outputs: append-only event streams, rebuildable projections, optional verified
snapshots, expected-version writes, deterministic idempotency fingerprints,
explicit atomic transactions, worker-independent outbox lifecycle, immutable
audit entries, DTO mappers, and reference adapters.

Tests: tenant isolation, atomic projection/event/idempotency/audit/outbox
writes, concurrency, dedupe, replay equivalence, append immutability,
commit/rollback, transaction closure, and outbox transitions.

Non-goals: PostgreSQL, Supabase, ORM, migrations, production adapters, running
workers, schedulers, brokers, external effects, providers, HTTP, or UI.

Acceptance: the Source Acceptance Gate is green. Existing hosted gates run once
as infrastructure regression checks; external connectivity timeouts may remain
Pending without changing source acceptance.

## REV-011E — Execution Engine and AI Provider Abstraction

Implementation status: Complete.

Scope: provider-independent `@reviva/execution`, trusted immutable requests,
closed purposes, planner/provider contracts, exact versioned output validation,
deterministic provider/model selection, maximum-two retry policy, one repair,
explicit fallback, uncertain-outcome reconciliation, mandatory usage/cost
ceilings, and data-only tool proposals.

Prerequisites: REV-011B–D are Complete. Production provider/model evaluation,
prompt bundles, provider credentials, and real monetary policy resolution are
not prerequisites for the pure engine and remain future composition work.

Outputs: pure orchestration contracts and engine plus deterministic scripted
reference adapters. Provider-native types do not cross the contract.

Tests: request construction, purpose/capability/handoff denial, provider/model
selection and fallback order, exact schemas, repair, retry, uncertainty,
budgets, usage validation, proposal integrity, and adapter failure containment.

Non-goals: real provider SDK/inference, prompt bundles/evaluations, tool
execution, persistence, migrations, background workers, HTTP/API, streaming,
UI, booking integration, or voice.

Acceptance: structured proposals cannot bypass capability/tool policy; providers
cannot authorize, execute, persist, select themselves, or control orchestration.
The source and hosted gates passed and CTO approval closed REV-011E.

## REV-011F — Tool Runtime, Human Handoff, and Application Integration

Implementation status: Complete following CTO technical review.

Scope: trusted runtime request/result contracts, a closed executable handler
registry, authorization/confirmation/approval revalidation, exactly-once
transaction coordination, normalized continuation, execution records, deferred
outbox effects, controlled handoff, and an explicit composition root.

Prerequisites: REV-011B–E. These are Complete.

Outputs: pure `@reviva/runtime`, deterministic reference persistence/handlers,
initial deferred booking creation and approved cancellation-request handlers,
and a closed handoff lifecycle integrated with Conversation state.

Tests: trusted request construction, registry boundaries, policy revalidation,
confirmation/approval scope and expiry, idempotent duplicates/concurrency,
transaction rollback, outbox atomicity, execution/reconciliation,
continuation, handoff lifecycle/roles/versioning, and security boundaries.

Non-goals: production persistence or migrations, real AI/provider SDK, real
booking/messaging gateway, production outbox worker, web endpoint/streaming UI,
operator dashboard, browser E2E harness, or voice.

Acceptance: source gates and deterministic runtime tests are green; human
ownership suppresses autonomous effects; uncertain outcomes cannot retry
blindly. CTO approval closed REV-011F. The Release Candidate is Ready to Start
under a separate execution order, but its implementation has not started.
Its Execution Transcript is planned. AUD-005 remains open because no approved
real browser/HTTP harness exists.

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
