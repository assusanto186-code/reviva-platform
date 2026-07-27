# ADR-006: Conversation Events, Outbox, and Idempotency

Status: Accepted

Date: 2026-07-18
Accepted: 2026-07-18

Related milestone: REV-011A

## Context

A conversation turn may update state, append audit evidence, call a model,
schedule a booking effect, deliver a message, or hand ownership to a person.
External calls inside database transactions would hold locks and still could
not guarantee exactly-once effects. Concurrent human, patient, AI, and worker
activity also makes last-write-wins unsafe.

## Decision

Conversation commands use optimistic `expectedVersion` semantics and short
transactions. One command transaction atomically claims idempotency, validates
authority/state, updates the projection, appends immutable message/event/audit
evidence, and creates outbox intents. Model, tool, booking, delivery, webhook,
streaming, and retry delay run outside the transaction.

Outbox handlers use leases, bounded classified retries, stable effect IDs,
external idempotency when available, mandatory reconciliation for uncertain
external mutations with no blind retry,
dead-letter state, and audited manual recovery. Correctness assumes at-least-
once execution; exactly-once delivery is not promised.

Audit/message/event reads use bounded opaque cursor pagination. Retention and
archival are class-specific; exact durations remain pending legal/privacy
approval.

Decision summary: short expected-version transactions atomically persist
internal truth and outbox intent; external effects occur afterward using
at-least-once-safe idempotency, reconciliation, and immutable evidence.

## Alternatives Considered

- External calls in one transaction: rejected due locks, timeouts, and
  irrecoverable uncertainty.
- Last-write-wins: rejected due lost human/user/tool updates.
- Permanent per-conversation worker/lock: rejected as primary correctness model
  for serverless operation.
- Mutable chat rows: rejected because corrections and decisions would erase
  evidence.

## Consequences

Positive: atomic internal evidence, recoverable side effects, duplicate safety,
explicit concurrency conflicts, replay/debugging, and scalable reads.

Costs: outbox lifecycle, reconciliation, dead-letter operations, projection
replay checks, and provider-specific idempotency adapters.

## Implementation Gate

Any production conversation-persistence milestone MUST prove clean migrations,
forced RLS, atomic state/event/audit/outbox writes, concurrency conflicts,
duplicate behavior, leases, retries, dead-letter recovery, cursor pagination,
and cleanup against Development PostgreSQL before an external effect is
enabled. The current REV-011D execution order intentionally delivers only
provider-independent contracts and deterministic reference adapters.

Reference: `docs/conversation/TRANSACTION_OUTBOX_IDEMPOTENCY.md`.

## Mandatory Follow-up

- REV-011B MUST make expected version, immutable event sequence, and duplicate
  command semantics executable domain contracts.
- REV-011D MUST implement provider-independent persistence, idempotency,
  transaction, outbox, audit, mapping, and reference-adapter contracts.
- Forced-RLS adapters, leases, reconciliation, bounded pagination, and
  recovery infrastructure require a later explicit execution order before any
  external effect is enabled.
- Retention duration configuration MUST wait for legal/privacy approval.

## Implementation Status

Architecture accepted. Completed REV-011B implements expected-version commands,
immutable ordered events, duplicate contracts, stale-action failures, and
deterministic replay in memory. REV-011D is Complete with repository
contracts, explicit transaction boundaries, deterministic idempotency,
validated outbox state, immutable audit, persistence mappings, and an
in-memory reference adapter. Migrations, production adapters, outbox workers,
and external effects remain unimplemented.
