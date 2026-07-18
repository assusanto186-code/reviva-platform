# Capability and Tool Policy

Status: REV-011A Complete — accepted architecture policy resolving AUD-001 and AUD-002

## Security Equation

```text
TenantContext proves tenant access
+ capability proves command authority
+ tool policy proves AI execution authority
+ confirmation proves patient consent when required
+ human approval proves operator authorization when required
= eligible action (still subject to state, version, budget, and idempotency)
```

No term substitutes for another.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Identity | Provider-verified subject or channel identity evidence |
| Principal | Server-bound identity authorized to initiate a request |
| Actor | Entity recorded as causing an event: staff, patient, AI, system, integration, or human operator |
| Membership | Current tenant relationship and role for a staff principal |
| Role | Administrative grouping used to derive default capabilities |
| Permission | Named action rule such as `booking.create` |
| Capability | Evaluated permission plus tenant/location/resource constraints and expiry |
| Command authority | Permission to request a domain command in current state |
| Tool authority | Separate allowlist permitting delegated AI execution of a specific tool/version |

## Actor Categories

- Authenticated staff user: bound through live Auth validation and active
  Reviva membership.
- Patient/contact: bound to channel/contact evidence; never receives staff
  membership authority.
- AI agent: system actor operating only under an explicit delegated grant.
- System process: scheduled/recovery actor with narrowly configured capability.
- External integration: authenticated adapter principal restricted to its
  channel/tool contract.
- Human operator: authenticated staff actor with assignment and capability
  evidence; distinct from the AI even when editing an AI draft.

`TrustedTenantContext` MUST carry or correlate to immutable principal evidence:
principal type, verified subject reference, authentication time/method where
available, membership version, and request ID. The database transaction context
continues to enforce tenant membership; application capability decisions MUST
be derived after this binding and persisted with commands. Browser or model
fields MUST NOT populate actor, role, tenant, or capability.

## Capability Matrix

Defaults are conservative and globally bounded. Tenant and location
configuration MAY narrow them and MUST NOT expand them beyond Reviva's global
maximum policy.

| Capability | Staff owner/admin | Manager | Agent | Viewer | Patient | AI default |
| --- | --- | --- | --- | --- | --- | --- |
| `conversation.read` | Yes | Yes | Assigned/scope | Assigned/read scope | Own conversation | Delegated current conversation |
| `conversation.respond` | Yes | Yes | Assigned | No | Own inbound only | Delegated, policy-limited |
| `conversation.assign` | Yes | Yes | No | No | No | No |
| `conversation.close` | Yes | Yes | Assigned with policy | No | No | Recommend only |
| `knowledge.read` | Yes | Yes | Yes | Yes | No direct port | Published retrieval only |
| `booking.availability.read` | Yes | Yes | Yes | No | Own request | Delegated if tool allowlisted |
| `booking.create` | Yes | Yes | Policy | No | Confirm own request | Delegated only after explicit confirmation of the complete summary |
| `booking.modify` | Yes | Yes | Policy | No | Confirm own appointment | Delegated only after fresh confirmation of every material change |
| `booking.cancel` | Human approval | Human approval | No | No | Request only | PROHIBITED from autonomous execution |
| `reactivation.send` | Yes | Yes | Campaign scope | No | No | Disabled until consent/policy approved |
| `handoff.request` | Yes | Yes | Yes | Yes | Yes | Yes |
| `handoff.resolve` | Yes | Yes | Assigned | No | No | No |
| `tool.execute` | Policy | Policy | Tool-specific | No | No | Delegated tool/version only |
| `audit.read` | Yes | Scoped | No | No | No | No |
| `membership.manage` | Yes | No | No | No | No | No |

## Capability Evaluation

Checks MUST occur at the application command boundary and again immediately
before side-effect execution. Inputs include principal, membership version,
tenant/location/resource ownership, assignment, aggregate state/version,
channel/contact relationship, delegated AI grant, confirmation/approval
evidence, tool/version policy, budget, and policy versions.

Authorization results MUST be immutable records containing decision code,
capability, actor/principal references, tenant/location/resource scope,
policy/grant versions, request/effect digest, result, reason code, and timestamp.
Secrets, raw tokens, passwords, cookies, and message bodies MUST NOT be stored.

## AI Delegation

AI authority MUST be narrower than the intersection of:

1. Reviva global allowlist;
2. tenant configuration;
3. location configuration;
4. current conversation/channel policy;
5. authenticated staff/system delegation where applicable;
6. current aggregate state;
7. confirmation and human approval requirements.

Delegation MUST name capabilities, tool IDs and versions, scopes, policy
version, budget, and expiry. Emma MUST NOT inherit all capabilities of the staff
user viewing the conversation. Patient confirmation authorizes only a stable
effect digest (action plus normalized material fields) and expires if relevant
state, price, slot, participant, or aggregate version changes.

Human approval MUST record approver principal, capability, effect digest,
policy version, timestamp, and expiry. Approval is not reusable for a different
effect.

## Tool Definition Contract

Each registry entry MUST define:

```text
ToolDefinition {
  id, version, inputSchemaVersion, outputSchemaVersion,
  requiredCapabilities[], sideEffectClass,
  confirmationPolicy, humanApprovalPolicy,
  tenantLocationPolicy, idempotencyPolicy,
  timeoutPolicy, retryPolicy, auditPolicy,
  adapterPort, enabledPolicyVersion
}
```

Provider-native names are aliases only. The registry resolves a closed Reviva
ID/version; unknown names never reach code execution.

## Tool Classes

| Class | Example | Confirmation | Human approval | Retry/idempotency |
| --- | --- | --- | --- | --- |
| A — read-only | Availability lookup | Usually no | No | Safe bounded retry; request dedupe |
| B — internal reversible mutation | Assign internal conversation | Contextual | Capability-dependent | Required idempotency; compensating command |
| C — external reversible side effect | Create/modify appointment | Explicit patient confirmation REQUIRED | Policy-dependent | External idempotency plus reconciliation |
| D — irreversible/high risk | Cancellation, bulk reactivation | Always | REQUIRED | No blind retry; manual recovery |
| E — human-only | Membership change, policy override | Not applicable | Human executes | AI cannot schedule execution |

## Execution Lifecycle

```text
model proposal
→ Reviva structured schema validation
→ semantic and state validation
→ registry ID/version resolution
→ principal and capability evaluation
→ tool policy and tenant/location evaluation
→ confirmation/human approval evaluation
→ budget/rate evaluation
→ scoped idempotency claim
→ persist authorization + audit + outbox intent atomically
→ leased server-side execution
→ persist result/reconciliation
→ expected-version state transition
→ delivery/audit outcome
```

## Registry Failure Behavior

| Condition | Required behavior |
| --- | --- |
| Unknown tool | Reject as `ToolValidationFailure`; never fuzzy-match |
| Unsupported version | Reject or use explicitly configured compatible version; never silently upgrade |
| Invalid/unknown input | Reject; unknown fields fail closed for mutation tools |
| Unauthorized | Persist denial reason code; do not reveal internal policy |
| Missing confirmation | Return `ToolConfirmationRequired` with safe effect summary |
| Duplicate request | Return prior accepted outcome or in-progress handle |
| Timeout | Record uncertain outcome; reconcile before retrying effects |
| Partial failure | Persist steps/evidence; compensate or hand off by policy |
| Provider/tool retry | Reuse idempotency/effect identity and bounded policy |
| Human override | Record actor and reason; invalidate stale AI proposal |

## Accepted Product-sensitive Policy

- `booking.create` MUST follow availability selection, a complete summary, and
  explicit patient confirmation before idempotent execution is authorized.
- `booking.modify` MUST receive fresh explicit patient confirmation whenever
  date, time, location, practitioner, service, financial commitment, or deposit
  requirement changes. A material change invalidates previous confirmation.
- Autonomous `booking.cancel` is PROHIBITED. Emma MAY explain policy, collect a
  reason, prepare a request, and request handoff; a human must approve or act.
- Reactivation communication requires a validated consent or legitimate basis,
  permits no more than one active sequence per contact, and MUST stop
  autonomous outreach immediately after explicit opt-out.
- Tenant administrators MAY narrow Emma's authority but MUST NOT expand it
  beyond the global maximum. Subscription, location, conversation state,
  delegation, tool, confirmation, and approval constraints intersect.

## Pending Implementation Configuration

- Campaign frequency, queue routing, and production role-to-capability mapping.
- Actual cost ceiling values and rolling windows; both per-conversation and
  per-tenant ceilings remain mandatory.

## Non-goals

This document does not assign production role mappings, implement the registry,
or authorize any current repository method for AI execution.
