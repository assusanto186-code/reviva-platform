# Execution Engine and Provider Boundary

Status: REV-011E Complete

## Ownership

`@reviva/execution` owns inference orchestration. `@reviva/conversation` owns
business state, authorization vocabulary, the closed tool registry, and
persistence contracts. Dependency direction is one way:

```text
@reviva/execution -> @reviva/conversation -> @reviva/domain
```

Conversation code never imports execution or a provider. Provider adapters
implement `AIProvider` and perform inference only. A future application
composition root will resolve credentials and construct real adapters; no real
adapter or provider SDK exists in REV-011E.

## Trusted Request

`ExecutionRequest` contains caller-supplied identifiers, tenant and
conversation identity, actor, correlation/causation, conversation version and
state, already-authorized capabilities, delegation, a closed execution
purpose, canonical input/context, closed-registry tool descriptors, mandatory
budgets, provider policy, and schema version.

The engine does not query identity or membership and does not reinterpret
tenant authority. Missing, malformed, stale, ambiguous, or unlimited
configuration fails closed.

## Orchestration

1. Validate and freeze the request.
2. Verify the purpose-required capability and handoff boundary.
3. Validate the complete ordered provider/model policy.
4. Invoke the primary candidate with a versioned output contract.
5. Validate provider-reported usage against execution, conversation, and
   tenant ceilings.
6. Validate the exact planner schema and semantic tool/capability consistency.
7. If permitted, issue one typed repair request for invalid structured output.
8. Return a validated result, a typed failure, or a reconciliation request.

Provider selection, retry, repair, fallback, and budget enforcement are engine
responsibilities. A provider cannot select itself or widen authority.

## Structured Output and Planner

`planner_result` version 1 rejects missing and unknown fields, unsupported
versions, invalid enums, unbounded/control-character text, unknown reason-code
formats, and semantic mismatches. It contains no hidden chain-of-thought.
Concise reason codes are safe machine-readable outcomes, not private
reasoning.

Raw provider payloads never cross a successful result boundary. An initially
invalid payload may receive one repair request containing only deterministic
validation failure codes and the expected output contract. A second invalid
payload fails as `StructuredOutputInvalid`; repair never loops.

## Retry, Fallback, and Uncertainty

- Retry applies only to typed, definitive, retryable failures.
- Provider retry and structured-output repair have separate counters.
- The policy maximum is capped at two provider retries.
- Fallback is deterministic, uses only the next declared candidate, and must
  be enabled within its explicit ceiling.
- Timeout before acceptance may be retryable.
- Timeout after possible acceptance, unknown provider status, and locally
  cancelled/unknown completion return `ReconciliationRequired`.

The `ProviderReconciler` contract exists for a future adapter, but REV-011E
performs no network reconciliation.

## Budget Model

No unlimited default exists. Mandatory integer ceilings cover:

- input, output, and aggregate tokens;
- provider attempts and separate repair attempts;
- fallback count;
- request cost micro-units;
- remaining conversation token/cost allowance;
- remaining tenant token/cost allowance;
- context entries, tool proposals, and provider timeout.

The engine checks known limits before invocation and validates reported usage
before returning any proposal. Pricing resolution stays outside pure engine
logic.

## ToolProposal Versus Execution

The engine can return zero or one immutable `ToolProposal`. It validates the
registered tool/version, required capability, actor category, arguments, and
confirmation/approval markers, then produces a canonical effect digest.
Required confirmation remains `required`; a provider cannot mark it confirmed.
Required human approval remains `required`; a provider cannot grant it.

No handler, callback, executable value, booking adapter, repository, outbox,
or network operation is stored or called. Tool execution remains outside
REV-011E.

## Reference Adapters and Exclusions

Scripted providers/planners are deterministic test references only. They are
not production adapters, real AI, or provider emulators. REV-011E includes no
provider SDK, prompt bundle, live inference, persistence, migration, endpoint,
streaming UI, background worker, real tool, voice runtime, or REV-011F work.
REV-011F subsequently adds a separate provider-independent Tool Runtime; it
does not change the REV-011E inference boundary.
