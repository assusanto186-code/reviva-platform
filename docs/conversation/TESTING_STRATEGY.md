# Conversational Core Testing Strategy

Status: REV-011A Complete — accepted testing architecture

## Testing Principles

- Domain and application tests MUST be deterministic and avoid real model calls.
- Provider, tool, delivery, and persistence adapters MUST share Reviva-owned
  contract suites.
- Tenant, capability, confirmation, idempotency, version, and correlation
  boundaries MUST be tested independently and in combination.
- Production prompts/models MUST NOT be accepted on anecdotal transcripts.
- Fake fixtures MUST contain no real patient data or PHI.

## Test Layers

| Layer | Required coverage | Real external service? |
| --- | --- | --- |
| Conversation domain | Every state/command/guard/failure and replay | No |
| Authorization policy | Principal binding, capability matrix, scopes, delegation, confirmation/approval | No |
| Tool registry | Schema/version/classification/unknown/unauthorized/duplicate/timeout | No |
| Application orchestration | Proposal→validation→command→transaction/outbox flow | No |
| Provider contract | Normalization, invalid output, refusal, timeout, retry, cancellation, usage | Fake by default; sandbox separately |
| Prompt/evaluation | Version snapshots, safety and business datasets, regression thresholds | Fake/snapshot; approved sandbox run |
| Persistence | Projection/event atomicity, RLS, pagination, optimistic conflicts, outbox leasing | Disposable/hosted Development PostgreSQL |
| Concurrency | Inbound races, human/AI race, stale confirmation/tool result, worker lease race | Deterministic plus PostgreSQL |
| Idempotency/outbox | Duplicate keys, uncertain external outcome, retry, dead letter, recovery | Fake adapter plus PostgreSQL |
| Handoff | Queue/accept/timeout/assist-only/resume/reopen | Fake handoff adapter |
| Web/API | Authenticated request, server context, stream cancellation, safe errors | Local E2E; hosted Auth where required |
| Provider/tool sandbox | Compatible payloads, limits, errors, idempotency/reconciliation | Explicit non-production sandbox only |

## Coverage Matrix

| Risk | Minimum cases |
| --- | --- |
| State machine | Valid/invalid transition from every state; terminal/reopen rules |
| Model proposal | Valid, unknown field, invalid schema, semantic mismatch, hostile text |
| Authorization | Every capability by actor; tenant/location mismatch; stale membership; narrowed tenant policy |
| AI delegation | Missing/expired/wider-than-global grant; tool/version not delegated |
| Confirmation | Missing, rejected, expired, stale effect digest, wrong contact |
| Human approval | Wrong approver/scope/version; revoked/stale approval |
| Tool lifecycle | Classes A–E; unknown/version/input/denial/timeout/partial/override |
| Knowledge | Unpublished, wrong tenant/location, stale/conflicting, poisoned content, rollback provenance |
| Concurrency | Two inbound messages; human reply versus AI; duplicate worker; stale result |
| Idempotency | Same key/same digest; same key/different digest; in-flight/completed duplicate |
| Outbox | Atomic creation; lease expiry; retry; uncertain result; dead letter; manual recovery |
| Audit | Atomic decision evidence; no secrets/content leakage; cursor bounds and tenant isolation |
| Cost/rate | Reservation/settlement; budget exceed; cancellation usage; anomalous request burst |
| Handoff | Request, queue, accept, no acceptance, continued messages, resolve, reopen |
| Delivery/stream | Chunk ordering, disconnect, cancellation, late provider completion, no premature action |

Accepted policy tests MUST include: booking creation without explicit patient
confirmation is denied; every material appointment modification invalidates
prior confirmation; autonomous cancellation is denied and routed to human
approval; tenant configuration cannot widen global authority; structured-output
repair stops after one attempt; provider retry stops after two retries; uncertain
external mutation enters reconciliation; both mandatory cost ceilings fail
closed; handoff urgency selects the provisional SLA target; and reactivation
opt-out immediately stops autonomous outreach.

## Deterministic Provider and Tool Fakes

The fake provider supports scripted proposals, usage, delays, streaming chunks,
cancellation, safety rejection, malformed output, transient/terminal errors, and
provider request IDs. Fake tools support stable effect IDs, duplicate execution,
partial/uncertain results, reconciliation, compensation, delay, and failure.

Tests MUST control time, IDs, sequence, policy versions, and concurrency gates.
Prompt snapshot tests compare approved prompt bundles and metadata, not hidden
reasoning. Evaluation datasets store expected safe behavior, allowed outcome
ranges, failure severity, and reviewer notes.

## Prompt-injection Dataset

Cases include patient role escalation, hidden instructions in published
knowledge, external tool-output instructions, cross-tenant requests, secret
exfiltration, false confirmation, fabricated booking success, medical-advice
pressure, multilingual obfuscation, excessive context, and cost-exhaustion
attempts. Passing requires deterministic authorization and safe failure even
when assistant wording varies.

## Existing Gate Preservation

REV-011 work MUST keep current root lint/build/tests, 16 hosted PostgreSQL tests,
hosted Auth integration, linked database lint, migration synchronization,
secret scans, and artifact checks green. Conversation database tests MUST use
Development-only guards and crash-recoverable fake fixtures.

## Phase Acceptance Gates

### REV-011B

- Pure domain/state machine package only.
- Transition and invariant matrix passes without network/database.
- Expected-version command contract and typed failures approved.
- No provider/tool/persistence implementation.

Implementation evidence: the package-specific deterministic suite exercises
domain lifecycle, booking/reactivation, handoff, duplicate/concurrency/stale
actions, replay integrity, and accepted/denied transitions for every top-level
state. Exact counts are reported by the current quality gate and MUST NOT be
treated as a code-coverage percentage.

### REV-011C

- Principal/capability/tool registry contract suites pass.
- AI delegation is demonstrably narrower than staff/global policy.
- Confirmation/approval/effect-digest cases pass.
- No external tool effects.

Implementation evidence: deterministic tests cover the canonical capability
set, authority intersection at every layer, active membership, actor authority,
AI delegation and staleness, conversation-state restrictions, booking
confirmation, cancellation approval, handoff/assist-only behavior,
reactivation basis and opt-out, human resume, registry construction and
immutability, unknown/duplicate tools, invalid or executable descriptors,
tool-capability matching, and a representative policy matrix. The current
quality gate reports exact test counts; these are not code-coverage percentages.
The closure gate also passed hosted Auth and hosted PostgreSQL integration,
linked database lint, and migration synchronization.

### REV-011D

- Strict TypeScript and deterministic in-memory contract suites pass.
- Append-only streams, projection rebuild, snapshot equivalence, optimistic
  conflicts, idempotency, transaction atomicity, outbox lifecycle, immutable
  audit, DTO validation, and tenant isolation are covered.
- Rollback leaves no partial reference data and closed transactions cannot be
  reused.
- Existing hosted gates remain regression checks; REV-011D introduces no
  migration or production database adapter.

Implementation evidence: the deterministic reference suite covers event load
and append, full and snapshot-assisted replay, projection/snapshot
compare-and-set, canonical fingerprints, duplicate outcomes, coordinated
commit and rollback, concurrent writers, outbox claim/failure/retry/publish,
audit ordering and safety, mapping validation, and explicit tenant boundaries.
Exact counts are reported by the current quality gate.

### REV-011E

Implementation status: Complete.

- Deterministic request and engine suites cover trusted construction,
  purpose/capability/handoff denial, provider/model policy, fallback order,
  schema shape/enums/versions, one repair, maximum two retries, definitive
  versus uncertain timeout, reconciliation, token/cost/attempt ceilings,
  provider usage validation, and tool-proposal integrity.
- Scripted provider/planner references use no clock, randomness, filesystem,
  environment, database, network, or real AI.
- Provider exceptions fail closed and raw unvalidated payloads never appear in
  completed results.
- Prompt snapshots/evaluations and external-provider sandbox compatibility are
  deferred because REV-011E introduces no prompt bundle or real provider
  adapter.

### REV-011F

Implementation status: Ready to Start; implementation has not started.

- Handoff races and ownership tests pass.
- Authenticated route-level E2E proves current user/context, safe streaming,
  cancellation, and error behavior.
- AI does not send/execute after human ownership transfer.

### REV-011G

- Prompt-injection and tool-authorization evaluation gates pass.
- Hosted provider sandbox and external-effect sandbox evidence is recorded.
- Budget/rate/observability and operational recovery evidence passes.
- Security review approves remaining product-sensitive policies.

## Non-goals

This strategy does not set numeric quality thresholds, choose E2E/evaluation
vendors, or authorize production model calls. Evaluation thresholds, sandbox
budgets, and actual monetary ceilings require approval before their phase.
