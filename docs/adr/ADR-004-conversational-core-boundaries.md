# ADR-004: Conversational Core Boundaries

Status: Accepted

Date: 2026-07-18
Accepted: 2026-07-18

Related milestone: REV-011A

## Context

Emma needs deterministic conversation behavior without coupling business rules
to Next.js, PostgreSQL, an AI provider, or booking systems. Existing domain,
Auth, tenant-context, transaction, RLS, knowledge, and audit foundations are
reusable, but no conversational boundary exists.

## Decision

Create, during separately authorized implementation, a pure
`@reviva/conversation` domain and an `@reviva/application` orchestration layer.
The domain owns aggregate states, commands, events, invariants, failure types,
capability vocabulary, and ports. Application orchestration owns provider/tool
coordination, policy order, idempotency workflow, and transaction boundaries.

Messages/events are immutable append streams. A versioned aggregate projection
holds command state. Provider output is an untrusted proposal and cannot choose
state, principal, capability, or tool implementation. `apps/web` remains the
composition/delivery root. Provider, channel, tool, and PostgreSQL code remain
adapters.

Decision summary: the conversational core is a pure deterministic domain with
separate application orchestration and vendor-specific adapters. Immutable
events/messages and an expected-version projection form its state boundary.

## Alternatives Considered

- Put orchestration in Next.js routes: rejected due framework coupling and weak
  deterministic testing.
- Put conversation models in `@reviva/domain`: rejected initially to avoid
  expanding an existing tenant/knowledge package into an uncontrolled hub.
- Full event sourcing with no projection: rejected due command/query and
  operational complexity.
- Provider-native agent runtime as core: rejected because provider objects and
  arbitrary tool calls would control architecture.

## Consequences

Positive: deterministic tests, vendor independence, explicit transaction/tool
boundaries, replayable evidence, and replaceable delivery adapters.

Costs: more explicit ports, projection/event consistency requirements, and
translation code. Package creation requires separate approval in REV-011B.

## Implementation Gate

ADR approval authorizes design direction only. REV-011B MUST prove the state
machine without network/database/provider dependencies. No runtime package,
migration, endpoint, or provider integration is created by REV-011A.

References: `docs/conversation/CONVERSATION_ARCHITECTURE.md` and
`docs/conversation/STATE_MACHINE_SPEC.md`.

## Mandatory Follow-up

- REV-011B MUST implement and deterministically test the pure conversation
  domain without provider, database, framework, clock, or random dependencies.
- REV-011C MUST implement application capability/tool authorization separately.
- REV-011D MUST add persistence only after the domain contracts are stable.

## Implementation Status

Architecture accepted. REV-011B completed the pure `@reviva/conversation`
domain and deterministic tests. REV-011C completed capability authorization
and the closed non-executing tool registry.
REV-011D is Complete with provider-independent persistence contracts and a
deterministic in-memory reference adapter. No production infrastructure
adapter has started.

REV-011E refines the separately owned provider-inference orchestration boundary
into focused package `@reviva/execution` instead of a broad
`@reviva/application` hub. The package depends on `@reviva/conversation`; the
domain has no reverse dependency. The execution engine owns declared
provider/model selection, structured-output validation, retry, repair,
fallback, uncertain-outcome classification, and budget enforcement. Providers
perform inference only. Authorization remains trusted input and tool execution
remains outside providers and the engine. General application use-case,
transaction, endpoint, and delivery orchestration remains unimplemented.
REV-011E is Complete after passing CTO review and its source and hosted quality
gates.
