# @reviva/execution

Provider-independent, deterministic orchestration for Reviva inference.
REV-011E is Complete.

## Boundary

The package depends only on `@reviva/conversation`. It has no dependency on
Next.js, React, Supabase, PostgreSQL, provider SDKs, HTTP clients, browser APIs,
the filesystem, or process environment. `@reviva/conversation` never depends
on this package.

The engine accepts already-resolved trusted facts. It does not resolve tenants,
memberships, entitlements, or credentials. It never mutates a conversation,
persists data, executes a tool, publishes an outbox message, or performs
network I/O.

## Execution Contract

```text
trusted ExecutionRequest
  -> deterministic provider selection
  -> provider inference contract
  -> versioned structured-output validation
  -> optional one repair request
  -> zero or one validated ToolProposal
  -> typed ExecutionResult
```

Providers perform inference only. They do not authorize capabilities, select
themselves, control retries or fallback, execute tools, or determine business
policy. Provider-native types do not cross the `AIProvider` boundary.

## Policy and Safety

- Execution purposes are a closed vocabulary with schema, capability, tool,
  autonomous-effect, budget-class, and provider-policy metadata.
- Provider/model candidates are explicitly ordered by the caller. Unknown,
  incompatible, or undeclared candidates fail closed.
- Retry is limited to typed retryable definitive failures and at most two
  provider retries.
- Structured-output repair has a separate budget and occurs at most once.
- Fallback uses only explicit candidates and a mandatory fallback ceiling.
- Outcomes that may already have been accepted by a provider return
  `ReconciliationRequired`; they are never retried blindly.
- Mandatory ceilings cover input, output, total usage, provider calls, repair,
  fallback, cost micro-units, context entries, and tool proposals.
- Raw provider payloads, private reasoning, credentials, and executable
  functions never appear in a completed result.

## Tool Proposals

A `ToolProposal` is immutable data, not an invocation. Its tool/version must
exist in the supplied closed registry, match an already-authorized capability
and actor category, and preserve registry confirmation/human-approval
requirements. The engine computes a deterministic effect digest but supplies
no handler or adapter.

## Public API

The root export exposes intentional execution, planner, provider, structured
output, policy, reconciliation, result/failure, identifier, and tool-proposal
contracts plus `createExecutionEngine` and safe identifier/request
constructors. Internal registries, freezing helpers, parsers, and scripted
reference fixtures are not package exports.

## Reference Implementations

`src/reference` contains deterministic scripted provider and planner fixtures
used by package tests. They perform no network activity, are not real AI, keep
no durable state, and are not for production composition.

## Commands

```powershell
pnpm --filter @reviva/execution lint
pnpm --filter @reviva/execution build
pnpm --filter @reviva/execution test
```

The tests use fixed identifiers, inputs, responses, usage, and policies. They
require no clock, randomness, environment, filesystem data, database, network,
or provider account.
