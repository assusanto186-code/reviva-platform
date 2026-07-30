# ADR-005: Capability-authorized Tool Execution

Status: Accepted

Date: 2026-07-18
Accepted: 2026-07-18

Related milestone: REV-011A

## Context

Current `TenantContext` proves active tenant membership and role but not
command-specific authority. Broad tenant-scoped persistence cannot safely be
exposed to model-driven orchestration. Emma must distinguish information,
reversible internal changes, external effects, high-risk effects, confirmation,
and human approval.

## Decision

Every command and tool execution requires separate, persisted evaluation of:

1. server-bound principal and trusted `TenantContext`;
2. capability scoped to tenant/location/resource/state;
3. closed registry tool identity/version and AI delegation policy;
4. patient confirmation for the exact effect when required;
5. human approval for high-risk/human-only policy;
6. aggregate version, budget, and idempotency.

AI receives no repository, credential, arbitrary function, or inherited staff
authority. Tenant configuration MAY narrow global authority and MUST NOT expand
it. The registry owns input/output schemas, effect class,
capabilities, confirmation/approval, retry, timeout, idempotency, audit, and
scope policy.

Decision summary: effective AI authority is an intersection of global,
subscription, tenant, location, state, delegation, tool, confirmation, and
human-approval constraints. Booking creation and material modification require
explicit confirmation; autonomous cancellation is prohibited.

## Alternatives Considered

- Role checks only: rejected because roles are broad and lack action context.
- RLS only: rejected because RLS isolates tenants but does not authorize a
  viewer/AI to mutate a permitted tenant row.
- Provider function calling directly into handlers: rejected because model text
  could select executable code.
- Grant AI the current staff user's authority: rejected as excessive delegation.

## Consequences

Positive: resolves AUD-001/002 design risk, makes denials auditable, supports
least authority and confirmation, and keeps tools provider-independent.

Costs: policy versioning, effect digests, additional decision records, and
product approval for sensitive actions.

## Accepted Product Policy

- Booking creation MUST follow explicit patient confirmation of the complete
  effect summary.
- Material appointment modification MUST invalidate old confirmation and obtain
  fresh explicit patient confirmation.
- Autonomous appointment cancellation is PROHIBITED and requires human
  approval or action.
- Reactivation requires a validated communication basis and MUST stop
  immediately after explicit opt-out.
- Tenant configuration MUST NOT widen the Reviva global maximum.

## Implementation Gate

REV-011C MUST pass the full actor/capability/tool matrix before any live tool
adapter or external effect is implemented.

## Mandatory Follow-up

- REV-011B MUST expose actor, correlation, causation, and required-capability
  context without implementing infrastructure authorization.
- REV-011C MUST implement the closed registry and capability evaluator.
- Hosted external-effect verification is REQUIRED before any reconsideration
  of autonomous cancellation.

## Implementation Status

Architecture accepted. Completed REV-011B exposes actor/delegation context and
command capability requirements. REV-011C is Complete with one canonical
capability vocabulary, deterministic authority intersection, typed decisions,
and a closed provider-agnostic registry. The
registry contains no execution functions and the evaluator performs no external
effect. REV-011F now implements a separate `@reviva/runtime` boundary that
revalidates this policy before invoking a closed handler. Its initial handlers
and adapters are deterministic deferred references only; no live external
effect or production adapter is authorized.
