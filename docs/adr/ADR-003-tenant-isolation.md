# ADR-003: Defense-in-Depth Tenant Isolation

Status: Accepted

Date: 2026-07-16

Deciders: Reviva Engineering

Related milestone: REV-009

## Context

Reviva is a multi-tenant SaaS product. A cross-tenant read, write, cache hit,
file access, audit query, or background job is a launch-blocking security
failure. Application filters alone are insufficient because one omitted
predicate can expose another med spa's data.

`@reviva/domain` already requires `TenantContext` at repository boundaries and
uses opaque identifiers, tenant-owned models, and in-memory isolation tests.
Production must preserve those contracts and add database-enforced isolation,
credential separation, transaction context, storage controls, and production
tests.

## Decision

Reviva will use a shared PostgreSQL schema with mandatory `tenant_id` columns,
composite tenant-aware constraints, PostgreSQL Row Level Security (RLS), and a
restricted runtime database role. Isolation is enforced independently at the
request, application, repository, database, storage, cache, job, and audit
boundaries.

No production request may access a tenant-scoped repository without a validated
`TenantContext`. No tenant table may depend only on application-written
`where tenant_id = ...` clauses for isolation.

### TenantContext resolution

`TenantContext` is resolved only on a trusted server boundary:

1. Supabase Auth validates the user session.
2. The Auth subject resolves to an active Reviva user.
3. A tenant candidate resolves to an active membership in an active tenant.
4. The database-derived membership supplies the Reviva role.
5. The server generates a request ID.
6. The resulting context is immutable for the transaction and passed explicitly
   to repositories, application services, audit writers, jobs, and cache keys.

The actor can switch tenants only by repeating membership resolution. A client
cannot override `actorId`, `actorRole`, or `tenantId` inside an established
context.

### Database enforcement

Every tenant-owned table will:

- define `tenant_id uuid not null`;
- include tenant-aware unique keys and foreign keys, such as
  `(tenant_id, id)` and `(tenant_id, organization_id)`;
- enable and force RLS;
- deny access when transaction tenant context is absent or malformed;
- grant access to a restricted runtime role that neither owns tables nor has
  `BYPASSRLS`;
- prevent tenant ownership from changing after creation.

At the beginning of every repository transaction, the adapter will set local
PostgreSQL settings for tenant ID, actor ID, request ID, and role. Policies read
only transaction-local settings, for example:

```sql
alter table knowledge_entries enable row level security;
alter table knowledge_entries force row level security;

create policy knowledge_entries_tenant_isolation
on knowledge_entries
for all
to reviva_app
using (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
)
with check (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
);
```

Context is set with transaction-local `set_config(..., true)` calls so pooled
connections cannot leak tenant state to a later request. Repository operations
outside the transaction wrapper fail closed.

Policies may add role-specific authorization, but business authorization also
remains explicit in the domain/application layer. RLS is the isolation backstop,
not the only place business permissions live.

### Service credentials

- Normal application persistence never uses Supabase secret/service-role keys
  or a PostgreSQL role with `BYPASSRLS`.
- Migration credentials are available only to controlled CI/release operators
  and never to the web runtime.
- Administrative service credentials are isolated by function, environment,
  and owner. Their use generates an audit event.
- Background jobs use the same restricted tenant transaction boundary. A job
  message carries a tenant candidate and signed job ID, then revalidates tenant
  state before accessing data.
- Break-glass cross-tenant access is not implemented for the first customer. If
  later required, it needs a separate ADR, MFA, reason capture, time limits,
  alerts, and immutable audit evidence.

### Data model and query rules

- Global `User` identities may exist without `tenant_id`; access to tenant data
  always proceeds through `Membership`.
- Tenant-owned resource IDs use UUIDs and are never considered secret access
  tokens.
- Foreign keys include `tenant_id` so a child cannot reference a parent in
  another tenant even when application validation fails.
- Unique business keys are scoped by tenant unless explicitly global.
- Lists, counts, search, exports, aggregates, and audit queries are subject to
  the same isolation rules as single-record reads.
- Cache keys begin with environment and tenant ID. Shared cache values may not
  contain tenant data unless tenant identity is part of both write and read
  authorization.
- Logs and metrics use opaque IDs and never include knowledge content, lead
  fields, conversation text, PHI, or credentials.

### Storage isolation

Private Supabase Storage buckets will use object paths beginning with the tenant
ID and RLS policies that validate both membership and path tenant. Object owner
metadata alone is not authorization. Signed URLs are short-lived, scoped to one
object, generated server-side, and audited for sensitive exports.

Storage is not approved for patient medical records, PHI, real customer
conversations, or production voice recordings under this ADR.

### Audit enforcement

Every state-changing transaction appends an audit event containing tenant,
actor, request, action, resource, timestamp, and safe structured metadata.
Audit writes occur in the same transaction as the business mutation. Audit
tables are tenant-readable only through authorized operations and immutable to
the runtime role.

Database-level context and constraints must make it possible to identify the
tenant and request responsible for every mutation. Failed cross-tenant attempts
produce security telemetry without logging protected payloads.

### Required production isolation tests

The same conformance suite will run against a disposable PostgreSQL database
and must prove:

- reads, lists, counts, search, and aggregates never return another tenant;
- inserts and updates cannot assign or change another tenant's ownership;
- cross-tenant foreign keys fail;
- a missing transaction tenant fails closed;
- transaction-local context does not leak through pooled connection reuse;
- concurrent writes produce one success and one typed conflict where optimistic
  locking applies;
- a failed multi-record operation rolls back business and audit writes;
- knowledge publish and rollback preserve one active version and full history;
- audit rows persist, are tenant-scoped, and cannot be updated or deleted;
- runtime credentials cannot disable policies, migrate schema, or bypass RLS;
- storage and cache fixtures cannot cross tenant boundaries.

These tests are mandatory in CI before pilot deployment and must run against
the same migration set used in production.

## Consequences

### Positive

- A missing application filter does not automatically become a data breach.
- Tenant ownership is protected by both domain contracts and database rules.
- The architecture works with pooled serverless connections while preventing
  session-state leakage.
- Shared conformance tests can compare in-memory test doubles with PostgreSQL
  behavior.

### Costs and risks

- RLS policies, composite foreign keys, and transaction context increase schema
  and test complexity.
- Direct PostgreSQL access cannot rely automatically on `auth.uid()`; the
  trusted application must validate Auth and set database transaction context.
- A migration owner can bypass RLS, so credential separation and audit are
  mandatory.
- RLS can affect query planning; tenant-leading indexes and measured query plans
  are required as data grows.

## Alternatives Considered

- **Application filters only:** rejected because one omitted predicate can
  expose another tenant.
- **Schema per tenant:** deferred because migration fan-out and connection
  management are disproportionate for the first-customer stage.
- **Database per tenant:** deferred because cost and operations are high; it may
  be reconsidered for regulatory or enterprise isolation requirements.
- **Use service-role credentials for every request:** rejected because those
  credentials bypass RLS and turn every application defect into a potential
  cross-tenant incident.

## Implementation Gate

Production persistence is not complete until migrations, restricted roles,
forced RLS, transaction context, composite constraints, audit immutability, and
the full disposable-PostgreSQL isolation suite are committed and passing.
Passing only the in-memory tests is insufficient.

### Verification — 2026-07-17

The hosted Supabase Development suite passed 13 integration tests three times with
unique fake fixtures. Evidence includes cross-tenant read/update/delete denial,
missing and invalid context rejection, forced-RLS enforcement, runtime
administrative denial, immutable tenant ownership, transaction-local context
cleanup after commit and rollback, and transaction object invalidation. Cache
and external-search isolation remain pending until those systems exist.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing Supabase data](https://supabase.com/docs/guides/database/secure-data)
- [Supabase PostgreSQL connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage)
- [Supabase Storage object ownership](https://supabase.com/docs/guides/storage/security/ownership)
