# Conversation Persistence Contracts

Status: REV-011D Complete

## Boundary

REV-011D defines provider-independent contracts in `@reviva/conversation`.
There is no PostgreSQL, Supabase, ORM, migration, HTTP, provider SDK, tool
executor, worker, scheduler, broker, or UI implementation.

The included in-memory adapter is a deterministic reference implementation. It
is not durable and is not safe for multi-process deployment.

## Source of Truth and Replay

Immutable conversation event streams are authoritative. Append requires the
exact expected aggregate version, tenant and conversation identity, supported
event schema, and contiguous sequence. Unknown streams return an explicit
not-found result.

Projections are replaceable materialized views guarded by compare-and-set
versions and rebuildable from the full event stream. Optional snapshots contain
the projection, aggregate version, schema version, tenant/conversation
identity, and deterministic integrity fingerprint. A snapshot cannot be ahead
of its stream. Full replay and snapshot-assisted replay must converge.

## Idempotency and Concurrency

An idempotency record is scoped by tenant, actor, operation, and key. The
request fingerprint uses stable canonical serialization and never stores the
source payload. The same key and fingerprint returns the existing processing,
completed, or failed outcome; a different fingerprint raises a typed mismatch.

Event, projection, snapshot, and transaction-store writes expose typed
optimistic-concurrency conflicts. Contracts never silently retry.

## Atomic Transaction

Every coordinated repository call receives one explicit `TransactionContext`.
The reference transaction uses copy-on-write state and atomically commits:

- event append;
- projection update;
- optional snapshot update;
- idempotency record;
- outbox enqueue;
- audit append.

Rollback and callback failure expose no partial changes. Commit, rollback, or
repository use after closure is rejected. Hidden nested coordinated
transactions are rejected.

## Outbox and Audit

Outbox records are immutable transport messages, separate from conversation
domain events and audit entries. Valid states are `Pending`, `Processing`,
`Failed`, and `Published`. Published records cannot return to a retryable state.
The contract assumes future at-least-once delivery and duplicate-safe
consumers; it does not claim exactly-once delivery.

Audit entries are tenant-scoped, append-only, deterministically ordered, and
record caller-supplied actor, correlation, action, aggregate version, and safe
metadata. Credential-bearing metadata keys, recognizable secret values, and
function-valued records are rejected.

## Explicit Exclusions

REV-011D does not implement durable storage, RLS for conversation tables,
outbox polling or publishing, retry scheduling, dead-letter infrastructure,
external effects, provider calls, booking integrations, endpoints, streaming,
or UI. Those capabilities require later approved milestones.

REV-011E is Complete with a provider-independent execution layer; this
persistence reference remains unchanged and is not used by the pure engine.
