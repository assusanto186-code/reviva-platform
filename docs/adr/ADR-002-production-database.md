# ADR-002: Supabase PostgreSQL as the Production Database

Status: Accepted

Date: 2026-07-16

Deciders: Reviva Engineering

Related milestone: REV-009

## Context

Reviva requires durable, transactional persistence for tenants, organizations,
locations, memberships, versioned knowledge, and append-only audits. The
runtime will deploy to Vercel, where application instances are ephemeral and
can scale horizontally. In-memory repositories therefore cannot be used
outside automated tests and explicit local demonstrations.

The database decision must support PostgreSQL transactions, tenant isolation,
schema migrations, optimistic concurrency, backup and recovery, and direct
implementation of the interfaces in `@reviva/domain` without coupling the
domain package to a database SDK.

## Decision

Reviva will use managed Supabase PostgreSQL as the first-customer production
database. Supabase Storage is accepted for future tenant-scoped knowledge files,
but storage objects will not contain PHI or production voice recordings until a
separate compliance milestone approves that data class.

The production adapter will be a separate workspace package, provisionally
named `@reviva/postgres`. It will depend on `@reviva/domain`; the dependency must
never point in the opposite direction. The adapter will use PostgreSQL wire
protocol access for transaction control rather than placing persistence logic
inside domain entities.

### Connection strategy

- Vercel runtime traffic uses the Supavisor transaction pooler over TLS because
  Vercel functions create temporary serverless connections.
- Prepared statements are disabled for transaction-pooler connections.
- Migrations, schema inspection, `pg_dump`, and controlled restore work use the
  direct database connection from an authorized environment.
- Runtime and migration credentials are different. The runtime role has only
  the table, sequence, function, and schema privileges required by the app.
- Connection strings are server-only secrets. They are stored per environment,
  rotated on exposure, and never returned through application APIs.
- Pool size, timeouts, slow queries, connection saturation, and failed
  transactions are monitored before pilot.

### Transaction boundary

Every write operation runs inside an explicit PostgreSQL transaction. A
Reviva-owned transaction coordinator will bind one database transaction and one
validated `TenantContext` to all repository adapters participating in a use
case. Multi-record knowledge publish and rollback operations must atomically:

1. validate tenant and membership context;
2. lock or concurrency-check the affected knowledge entry;
3. create the new immutable version;
4. supersede the previous published version;
5. update the entry's active version;
6. append the audit event;
7. commit all changes together or roll all of them back.

Individual repository interfaces in `@reviva/domain` remain unchanged. The
transaction coordinator is an additive infrastructure/application boundary;
it does not add Supabase or SQL types to those contracts.

### Optimistic concurrency

Mutable aggregate tables will contain a non-null `lock_version bigint` starting
at `1`. Updates that originate from a previously read operator state use a
conditional statement equivalent to:

```sql
update knowledge_entries
set ..., lock_version = lock_version + 1
where id = $1 and tenant_id = $2 and lock_version = $3;
```

Zero updated rows produce a typed concurrency conflict and never become a
silent overwrite. Because the existing domain repository contracts do not
carry an expected version, operator commands requiring optimistic concurrency
will use an additive application command envelope containing
`expectedVersion`. Existing repository signatures will not be changed or
misused to infer a version from timestamps.

Server-controlled lifecycle operations that do not originate from a stale
client snapshot may use `select ... for update` inside a short transaction.
Optimistic checks remain mandatory for human editing and other lost-update
risks.

### Schema and migration strategy

- SQL migrations in `supabase/migrations` are the only source of production
  schema change.
- Remote Dashboard changes to production tables are prohibited.
- Migrations are forward-only, timestamped, reviewed, tested with a local reset,
  and committed with application changes.
- Destructive changes use expand-and-contract: add compatible schema, backfill,
  deploy readers/writers, verify, and remove old schema in a later release.
- Every migration defines rollback or recovery instructions, even when the safe
  response is application rollback plus a forward repair migration.
- Only one controlled CI or release owner applies production migrations.
- Production and Preview use separate Supabase projects or approved isolated
  branches. Tests never target the production database.

### Backup and disaster recovery

Reviva will use a paid Supabase plan with managed daily backups before pilot.
The initial recovery targets are:

- RPO: 24 hours while daily backup is the only recovery source;
- RTO: 8 hours for the first pilot, including restore and application
  verification.

PITR must be enabled before stored business activity makes a 24-hour RPO
unacceptable. When enabled, the RPO/RTO will be revised from measured restore
drills rather than copied from vendor marketing.

Quarterly restore drills will restore into an isolated project, apply required
secrets separately, run migration and tenant-isolation verification, and record
actual recovery time. Database backups do not include Supabase Storage objects,
so storage needs a separate inventory, replication/export, and restore test
before it contains customer-controlled files.

Deleting a Supabase project also removes its managed backups. Off-platform
logical exports are therefore required on an approved schedule before pilot,
encrypted with restricted access and tested for restoration.

### Audit strategy

Audit records are append-only and committed in the same transaction as the
business change. Runtime roles receive `INSERT` and tenant-scoped `SELECT` only;
they do not receive `UPDATE`, `DELETE`, or `TRUNCATE` on audit tables. Database
constraints require actor, tenant, request, action, resource, and timestamp.
Administrative audit access uses a separately authorized path.

## Consequences

### Positive

- Reviva gets full PostgreSQL semantics, constraints, transactions, and tooling.
- Supabase aligns authentication, database, future storage, backups, and
  operational visibility in the approved first-customer stack.
- A PostgreSQL adapter preserves the existing domain layer and remains portable
  to another managed PostgreSQL provider.

### Costs and risks

- Supabase becomes a critical vendor and regional availability dependency.
- Serverless connection pooling and transaction-mode limitations require
  deliberate driver configuration.
- Backup availability is not proof of recoverability; drills and off-platform
  exports add operational work.
- Additive transaction and expected-version application boundaries are required
  because the current repository interfaces intentionally contain no SQL or
  concurrency types.

## Alternatives Considered

- **Supabase Data API for all persistence:** rejected as the only repository
  path because multi-repository transaction control is a core requirement.
- **Vercel-managed Postgres from another provider:** deferred because the CTO
  stack explicitly selects Supabase and its integrated Auth/Storage boundary is
  useful for the first customer.
- **Self-managed PostgreSQL:** rejected for the first customer because backup,
  upgrades, monitoring, and failover would consume engineering capacity without
  product differentiation.
- **In-memory or file persistence:** prohibited outside tests because it is not
  durable or safe under horizontal scaling.

## Implementation Gate

The adapter may be implemented only with:

- committed migrations and a non-production Supabase target;
- a restricted non-owner runtime role with RLS enforced;
- a tenant-bound transaction coordinator;
- concurrency conflicts and transaction rollback represented as tested errors;
- shared repository conformance tests running against PostgreSQL;
- fake/demo data only.

## Implementation Addendum — 2026-07-16

Postgres.js 3.4.9 is selected as the wire-protocol driver. It supports real
transactions through a reserved connection and disables prepared statements
with `prepare: false`, matching Supavisor transaction-pooler requirements.
`@reviva/postgres` owns the driver, mappings, transaction coordinator, typed
errors, and repository implementations. `@reviva/domain` remains unchanged.

The Vercel runtime may reuse a small client pool in a warm instance, but tenant
state exists only inside transaction-local PostgreSQL settings. Repositories
are invalidated when the coordinator callback ends.

### Hosted verification — 2026-07-17

The three ordered migrations are synchronized with the linked Supabase
Development database and remote lint reports no schema errors. The restricted
`reviva_app` role was authenticated through Supavisor transaction mode with
prepared statements disabled and its non-administrative attributes were
verified from PostgreSQL catalogs. Thirteen real-database integration tests
passed three times with unique fake fixtures and safe cleanup.

## References

- [Supabase Database overview](https://supabase.com/docs/guides/database/overview)
- [Connecting to Supabase PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase database backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
