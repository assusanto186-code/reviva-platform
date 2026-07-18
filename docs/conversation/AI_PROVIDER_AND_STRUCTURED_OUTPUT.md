# AI Provider and Structured Output Contract

Status: REV-011A Complete — accepted architecture contract

## Provider Port

The application layer owns a provider-independent port. Domain packages MUST
NOT receive provider SDK objects, provider tool-call formats, token-field names,
raw responses, or provider error classes.

Conceptual contract:

```text
AIProviderPort {
  generateStructured(request, cancellation): ProviderResult
  streamStructured(request, sink, cancellation): ProviderResult
  classifyRetry(failure): RetryClass
}

ProviderRequest {
  correlationId, purpose, conversationSnapshot,
  promptBundle, structuredOutputSchema,
  allowedToolDescriptors, knowledgeEvidence,
  modelPolicy, budgetReservation, deadline
}

ProviderResult {
  proposedOutput, providerRequestId,
  providerId, modelId, modelRevision,
  usage, latency, finishReason, safetyMetadata
}
```

Streaming is a delivery optimization. Structured completion and policy
validation MUST finish before a mutation or tool intent becomes authoritative.
Cancellation MUST propagate where supported and record whether provider usage
may still have occurred.

## Adapter Translation

Adapters translate Reviva requests into provider payloads and normalize
responses, usage, safety metadata, request IDs, finish reasons, timeout,
cancellation, rejection, and retry classification. Raw provider responses MUST
NOT be persisted by default. A minimal redacted diagnostic envelope MAY be
retained under an approved operational policy.

Model selection, fallback, temperature/configuration, and tenant overrides are
application policy, not domain behavior. Global safety bounds and cost ceilings
MUST NOT be relaxed by tenant configuration. A model revision change requires
evaluation evidence and a versioned configuration rollout.

No provider is selected by REV-011A. A future implementation MUST use a
deterministic fake for normal tests and MAY introduce one production adapter
only after provider evaluation. Fallback remains disabled until failure and
safety behavior is evaluated.

## Structured Output

Reviva-owned output separates proposal categories:

```json
{
  "schemaVersion": "proposal-v1",
  "assistantMessage": { "text": "...", "knowledgeReferenceIds": [] },
  "intent": { "kind": "informational", "confidence": "medium" },
  "entities": [],
  "missingInformation": [],
  "proposedCommand": null,
  "proposedTool": null,
  "confirmation": { "required": false, "reasonCode": null },
  "handoff": { "recommended": false, "reasonCode": null, "urgency": null },
  "safety": { "outcome": "allow", "reasonCode": null }
}
```

This is an illustrative contract, not an implemented schema. It MUST NOT carry
principal, role, tenant authority, capability grants, executable function
names, database fields, hidden chain-of-thought, or raw credentials.

## Validation Pipeline

1. Enforce response size and deadline.
2. Parse exactly one supported schema version.
3. Reject unknown fields for command/tool-bearing objects.
4. Validate types, enums, lengths, normalized identifiers, and reference
   existence.
5. Validate semantic consistency: proposed action matches intent, missing data,
   state, location, policy, and cited evidence.
6. Resolve tool only through the closed registry.
7. Evaluate capability, confirmation, approval, budget, and current version.
8. Convert an accepted proposal to a typed application command; otherwise use a
   deterministic fallback.

Model confidence is advisory. It MUST NOT authorize an action. Unknown schema
versions fail closed. Backward compatibility is explicit: readers MAY support a
bounded set of versions; writers emit only the active version. Breaking changes
require a new schema version and evaluation set.

## Invalid-output Recovery

- First invalid output: record `InvalidModelOutput`; MAY make exactly one repair
  attempt containing validation errors but no secrets.
- If that one repair attempt also fails, autonomous repair MUST stop, state
  MUST remain safe, and the runtime MUST return typed `InvalidModelOutput` plus
  deterministic fallback, missing-information request, or policy handoff.
- Mutation/tool proposals MUST NOT be inferred from malformed text.
- Provider refusal or safety rejection MUST NOT be rewritten as an authorized
  action by another prompt without policy review.

## Provider Retry and Budget Policy

- A retryable AI provider failure permits at most two retries after the initial
  request. The provider adapter MUST NOT exceed this architecture limit.
- Authorization failure, invalid state, missing confirmation, policy rejection,
  and non-retryable provider rejection MUST NOT be retried automatically.
- Retry timing and backoff are pending implementation configuration.
- Both a per-conversation cost ceiling and a per-tenant rolling cost ceiling
  are mandatory. Before provider execution, usage MUST be reserved against
  both. Reaching either ceiling MUST stop autonomous provider work, preserve
  state, provide a safe fallback or handoff, and append usage/audit evidence.
- Ceiling values and rolling windows remain pending implementation
  configuration.

## Prompt and Policy Versioning

A model interaction stores reconstructable metadata:

- prompt-template version and immutable content digest;
- system/safety/tool policy versions;
- output schema version;
- provider, model, and model revision identifiers;
- model configuration version;
- tenant instruction/configuration version;
- tool registry version and allowed tool descriptors;
- knowledge retrieval snapshot and version references;
- conversation aggregate version and correlation ID;
- input/output content references under retention policy;
- usage units, estimated cost, latency, retries, and finish/safety reason.

Hidden chain-of-thought MUST NOT be requested, stored, logged, or required for
audit. Investigation relies on approved inputs, structured proposals, policy
decisions, events, and provider metadata.

## Failure Taxonomy

| Failure | Retryable | User-visible | Operator/audit | Terminal default |
| --- | --- | --- | --- | --- |
| `AuthenticationFailure` | No | Generic sign-in required | Security audit | Request |
| `AuthorizationFailure` | Only after authority changes | Generic denied | Security audit | Command |
| `InvalidCommand` | No | Safe validation message | Optional audit | Command |
| `InvalidStateTransition` | Reload/re-evaluate | Usually hidden/clarify | Audit if effect-related | Command |
| `ConcurrencyConflict` | Bounded re-evaluation | Usually hidden | Metric/audit if repeated | No |
| `DuplicateRequest` | Return prior outcome | Prior/in-progress status | Metric | No |
| `ProviderUnavailable` | At most two retries after the initial request | Temporary delay | Log/metric | No |
| `ProviderRejected` | Policy-dependent | Safe refusal | Log/audit | Turn |
| `InvalidModelOutput` | At most one repair attempt | Safe fallback | Metric/evaluation | Turn |
| `ToolValidationFailure` | No | Clarify if useful | Audit | Proposal |
| `ToolUnauthorized` | No | Generic unable | Security audit | Proposal |
| `ToolConfirmationRequired` | New evidence required | Confirmation request | Audit | No |
| `ToolExecutionFailure` | Classification-dependent | Honest failure | Audit/log/metric | Effect |
| `ExternalDependencyFailure` | Bounded/reconcile | Temporary failure | Log/metric | No |
| `Timeout` | Operation-dependent | Delay | Metric | No |
| `Cancellation` | No automatic retry | Cancelled | Metric | Turn |
| `HandoffRequired` | Not an error retry | Handoff notice | Audit | AI ownership |
| `BudgetExceeded` | After budget change/window | Bounded notice | Audit/metric | Turn |
| `KnowledgeUnavailable` | After retrieval change | No-answer/clarify | Metric | Turn |
| `DeliveryFailure` | Bounded/idempotent | Channel-dependent | Audit/log | Delivery |
| `InternalInvariantFailure` | No blind retry | Generic safe failure | High-priority audit/alert | Conversation automation |

Only stable public reason codes are safe to expose. Provider messages, stack
traces, SQL details, policy internals, credentials, and sensitive content MUST
NOT reach clients.

## Testing Adapter

The deterministic fake provider MUST support scripted structured outputs,
delays, cancellation, usage, invalid schemas, safety rejection, transient and
terminal failures, and streaming chunks. Most domain/application tests MUST use
this fake and make no network calls.

## Pending Provider Evaluation and Implementation Configuration

REV-011A does not choose a provider, model, fallback provider, exact generation
settings, retry backoff, or monetary ceiling values. Intent and tool planning
MUST use low-variance configuration; informational wording MAY use bounded
configuration. Safety, authorization, the one-repair limit, the two-retry
limit, and mandatory cost ceilings are accepted architecture policy and MUST
NOT be relaxed by tenants or providers.
