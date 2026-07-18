# Safety, Message History, and Human Handoff

Status: REV-011A Complete — accepted architecture policy resolving AUD-012 and AUD-017

## Policy Hierarchy

From highest to lowest authority:

1. law, platform security, privacy, and Reviva global safety policy;
2. capability and tool policy;
3. approved tenant/location policy that only narrows global authority;
4. conversation state and confirmed user intent;
5. published tenant knowledge;
6. channel messages, external content, and tool output;
7. model proposal.

Lower layers MUST NOT override higher layers. Retrieved knowledge, patient
messages, tool output, and model text are untrusted content.

## Threat Model

| Threat | Realistic path | Mandatory controls | Safe failure |
| --- | --- | --- | --- |
| Malicious patient prompt | Requests hidden instructions, secrets, or unauthorized actions | Data minimization, output schema, capability/tool policy, redaction | Refuse/clarify/handoff |
| Poisoned tenant knowledge | Embedded instructions masquerade as policy | Published versions, provenance, content delimiting, instruction stripping/classification | Ignore instruction; cite bounded facts |
| Tool-output injection | External description contains commands | Typed output schema; treat strings as data | Reject invalid result or hand off |
| Provider hallucination | Fabricated availability/policy/action success | Evidence requirements, no-answer behavior, result correlation | Honest uncertainty; no success claim |
| Role confusion | Model claims staff/system authority | Server-bound principal; model cannot populate authority | Authorization denial |
| Cross-tenant retrieval | Bad filter/cache/index | Mandatory tenant/location context, RLS, tenant-keyed cache/search, isolation tests | Empty/error, security audit |
| Social engineering | Contact asks for another patient's details/action | Contact/resource binding and confirmation | Generic refusal/handoff |
| Unauthorized appointment change | Ambiguous or stale intent | Capability, effect digest, confirmation, current-version check | Reject stale/missing authority |
| Secret exfiltration | Prompt asks for keys, policies, logs | Secrets never in prompts/tools; redacted error/logging | Refuse and security signal |
| Hidden external instructions | Webhook/provider/calendar content | Adapter schema, allowlisted fields, content boundaries | Ignore or quarantine |
| Resource exhaustion | Repeated long turns/tools | Rate, token, cost, latency, and conversation budgets | Budget/rate failure and handoff |

Prompt injection cannot be eliminated. Defense MUST remain deterministic outside
the model and protect every side-effect path even if the model follows hostile
instructions.

## Message and Event Semantics

Immutable record categories:

- inbound user message;
- outbound assistant/human message;
- internal system event;
- state transition event;
- tool proposal and authorization decision;
- tool execution attempt/result;
- human note and handoff event;
- error/security event;
- delivery attempt/status event;
- consent/confirmation/approval event;
- provider interaction and usage settlement reference.

Messages and events MUST NOT be updated in place. Corrections append a
`MessageCorrection`; redaction appends a `RedactionApplied` event plus protected
redaction metadata while preserving an integrity reference as legally allowed;
delivery changes append attempts/status events. Human notes MUST be clearly
typed and never presented as patient-authored text.

Duplicate inbound messages are detected by tenant, channel account, and channel
message ID, backed by a payload digest. Ordering uses per-conversation aggregate
sequence assigned at commit. Source timestamp, received timestamp, and provider
ID are retained for clock-skew evidence. Replay uses sequence and stable event
ID, not wall-clock time alone.

## Handoff Model

```text
HandoffRequest {
  conversationId, reasonCode, safe summary reference,
  urgency, queue, requestedByActor,
  requestedAt, responseDeadlinePolicy,
  requiredCapabilities, tenantId, locationId
}
```

Handoff state records queue, assignee, ownership transfer, accepted/resolved
timestamps, resolution code, resume policy, and correlation IDs. Assignment and
resolution require current tenant/location scope and capability.

### AI behavior

- `AwaitingHuman`: AI MUST pause side effects and outbound autonomous replies.
  Policy MAY permit a bounded acknowledgment or safe information response.
- `HandedOff`: human owns the conversation. AI MAY prepare drafts or summaries
  only in assist-only mode; drafts MUST NOT auto-send.
- Resume requires an explicit authorized command, current-version check, and a
  new AI delegation grant.

### Race and timeout behavior

| Situation | Required behavior |
| --- | --- |
| Human replies while AI processes | Human version wins; stale AI output is suppressed |
| AI proposal arrives after handoff | Persist only as discarded diagnostic if policy allows; never execute/send |
| No human accepts | Escalate queue/urgency by versioned policy; notify patient honestly; no fake resolution |
| Patient continues messaging | Append inbound history; AI remains paused except permitted acknowledgment |
| Handoff resolves | Human records resolution and chooses `Active` or `Resolved` |
| Conversation reopens | Explicit reopen event and fresh ownership/delegation |

Provisional response targets are:

- Normal: four business hours;
- High: one business hour;
- Urgent or safety-sensitive: immediate queue escalation.

These targets are operational defaults, not contractual patient promises.
Tenant configuration MAY narrow them but MUST remain within global Reviva
limits, and externally presented targets require adequate tenant staffing.
Queue routing, patient wording, and after-hours mechanics remain pending
implementation configuration. Safety uncertainty, appointment cancellation,
privacy requests, complaints, medical advice, and uncertain external mutations
MUST request immediate handoff or escalation according to urgency.

## Sensitive-data Handling

Emma MUST collect only fields required by the approved workflow. Clinical
advice, diagnosis, and unnecessary PHI are outside the conversational core.
Prompts, logs, metrics, audit, evaluation fixtures, and provider payloads MUST
follow data minimization and retention policy. Secrets, credentials, cookies,
raw access tokens, database URLs, and hidden reasoning MUST never enter model
context or conversation history.

Content redaction must preserve auditability without exposing removed content.
Legal deletion, hold, export, and patient-data policy remain subject to privacy
and legal approval before pilot.

## Audit Pagination and Retention

Audit queries MUST require tenant context, explicit category/time filters, a
bounded page size, and opaque cursor based on stable `(occurredAt, id)` order.
Cross-tenant/admin audit access requires a separate privileged operational
boundary, not `reviva_app` broadening.

Retention classes:

| Class | Examples | Storage/query behavior |
| --- | --- | --- |
| Security/compliance | Auth denial, authorization, confirmation, tool effect, handoff ownership | Durable, integrity protected, paginated, restricted |
| Conversation content | Messages, notes, citations | Tenant policy and legal controls; redaction/deletion workflow |
| Operational | Provider latency, retries, worker leases | Short retention logs/metrics; no message bodies |
| Usage/billing | Units, estimate/settled cost, budgets | Ledger with reconciliation and billing access controls |
| Evaluation | Approved anonymized fixtures/results | Separate dataset and approval; no production secrets |

High-volume audit/message/event storage SHOULD support time-based archival or
partitioning when measured thresholds justify it. Architecture MUST support
configurable retention, archival, legal hold, redaction or tombstone semantics,
and separation of conversation content, audit evidence, operational telemetry,
and billing/usage evidence. Archival retains tenant scope, integrity, cursor
continuity, legal holds, and restore evidence. Exact durations remain pending
legal/privacy approval; archival thresholds remain implementation configuration.

## Usage and Observability

- Audit: who/what/why decision evidence and correlation, not full telemetry.
- Logs: redacted diagnostics, worker/provider failures, correlation IDs.
- Metrics: counts, latency, retries, cancellation, rate/budget rejection,
  handoff age, tool/provider health.
- Usage ledger: request count, model usage units, estimated/settled cost,
  provider/model/config, tenant/conversation budget reservation.
- Billing: separately derived, corrected through entries rather than mutation.

Anomalous usage detection SHOULD evaluate per-tenant and global request rates,
cost acceleration, repeated invalid outputs, repeated tool denials, and prompt
injection signals. Budget exhaustion fails closed before new provider/tool work.

## Non-goals

This document does not define retention days, select monitoring vendors,
implement redaction, permit medical advice, or approve autonomous high-risk
actions.
