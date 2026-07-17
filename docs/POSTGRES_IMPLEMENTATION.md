# PostgreSQL Adapter Implementation Note

Status: Complete and Verified on Hosted Development

Recorded: 2026-07-16; verified: 2026-07-17

Related decisions: ADR-002 and ADR-003

## Driver Decision

Reviva uses Postgres.js `3.4.9` inside `@reviva/postgres`. The driver is not a
dependency of `@reviva/domain`.

Reasons:

- tagged-template parameterization is the default query interface;
- `sql.begin` reserves one connection for a real PostgreSQL transaction;
- transactions can share one connection across all repository adapters;
- `prepare: false` is explicitly supported for transaction-pooler compatibility;
- the package has built-in TypeScript declarations and no transitive runtime
  dependencies.

## Connection Modes

### Migration and administration

`REVIVA_DB_ADMIN_URL` uses the direct Supabase PostgreSQL connection. It is used
only by controlled migration, schema validation, bootstrap, dump, and recovery
operations. It is never available to browser code or normal runtime handlers.

### Runtime and serverless

`REVIVA_DB_RUNTIME_URL` uses the Supabase transaction pooler on port 6543 and a
restricted `reviva_app` login. The client is configured with `prepare: false`,
a small connection limit, TLS, bounded connect/idle timeouts, and no automatic
transformation of tenant context.

A client may be reused by warm Vercel instances, but no tenant state is stored
on the client. Every use case opens a transaction, validates the caller's
`TenantContext` through a database function, and stores context only with
transaction-local `set_config` calls. The coordinator invalidates its repository
session after commit or rollback.

### Integration tests

Tests use `REVIVA_DB_ADMIN_URL` for fake fixture setup and
`REVIVA_DB_RUNTIME_URL` for runtime behavior. They require all Development
safeguard variables and reject a test project ref equal to the declared
Production project ref. Tests do not run against an unknown environment.

## Transaction and Concurrency Boundary

The coordinator calls `sql.begin`, sets validated tenant context, and provides
repositories bound to that transaction. Business mutation and audit append
therefore commit or roll back together.

Existing domain repository signatures remain unchanged. Server-controlled
updates lock existing rows within the transaction. Human-edit commands use an
additive `expectedVersion` operation that conditionally increments
`lock_version`; zero updated rows produce `OptimisticLockError`.

## Supabase CLI

Supabase CLI is pinned at `2.109.1` as a root development dependency. The
version-controlled workspace is `supabase/`. Local stack commands remain
blocked until Docker is healthy; hosted Development credentials must be stored
in an ignored `supabase/.env.local` file.

## Hosted Verification

The three migration versions are synchronized between Git and the linked
Supabase Development project. Linked database lint reports no schema errors.
The restricted runtime login was verified through the transaction pooler:
non-superuser, `NOINHERIT`, no role/database/schema creation, no replication,
and no `BYPASSRLS`.

Thirteen PostgreSQL integration tests passed three times with fresh fake UUIDs. They
verify cross-tenant read/update/delete protection, missing/malformed/unauthorized
context, forced RLS, administrative denial, atomic commit/rollback, optimistic
locking, immutable knowledge and tenant ownership, publish/supersede/rollback,
transaction-session invalidation, and context cleanup after commit/rollback.

## Pending Boundaries

Cache, full-text search, embeddings, and external search indexes are not part of
this persistence slice. Current repository lookup and list queries are
tenant-scoped and protected by RLS. No cache or search implementation may be
added until its key format, tenant context propagation, deletion behavior, and
cross-tenant integration tests are documented and implemented.
