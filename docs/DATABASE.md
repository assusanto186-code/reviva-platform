# Reviva Database Guide

Version: 1.0

Status: Architecture Approved, Implementation Pending

Owner: Reviva Engineering

Last reviewed: 2026-07-16

## Approved Platform

Supabase PostgreSQL is the production database. Vercel runtime traffic will use
the Supavisor transaction pooler with prepared statements disabled. Migration,
inspection, dump, and restore operations use a controlled direct connection.

The authoritative decisions are
[`ADR-002`](./adr/ADR-002-production-database.md) and
[`ADR-003`](./adr/ADR-003-tenant-isolation.md).

## Planned Core Schema

| Table | Ownership | Purpose |
| --- | --- | --- |
| `tenants` | global root | Tenant identity and lifecycle |
| `users` | global identity | Reviva user mapped to an Auth subject |
| `organizations` | tenant | Customer organization |
| `locations` | tenant | Med spa operating location |
| `memberships` | tenant | User role and tenant access state |
| `knowledge_sources` | tenant | Source ownership, kind, URI, and freshness |
| `knowledge_entries` | tenant | Stable knowledge key and active version |
| `knowledge_versions` | tenant | Immutable content revision and provenance |
| `audit_events` | tenant | Append-only business and security evidence |

All tenant tables use UUID identifiers, `tenant_id not null`, tenant-aware
foreign keys, tenant-leading indexes, timestamps, and explicit status checks.
Mutable aggregates include `lock_version bigint not null default 1`.

## Isolation Rules

- Enable and force RLS on every tenant table.
- Use a restricted runtime role without ownership or `BYPASSRLS`.
- Set tenant, actor, role, and request context transaction-locally.
- Deny operations when tenant context is absent.
- Scope uniqueness and foreign keys by tenant.
- Prohibit tenant reassignment after insert.
- Revoke update/delete/truncate privileges from runtime audit access.

## Transaction Rules

Every write uses an explicit transaction. Knowledge publish and rollback update
the entry, versions, and audit event atomically. Human editing commands carry an
expected `lock_version`; a zero-row conditional update is a typed concurrency
conflict, never last-write-wins.

## Migration Workflow

1. Create a timestamped SQL migration in `supabase/migrations`.
2. Define constraints, privileges, RLS policies, indexes, and comments together.
3. Reset and test a disposable local database from zero.
4. Run repository conformance, isolation, transaction, and migration tests.
5. Review SQL and recovery instructions in the same change.
6. Apply Preview migrations through one controlled process.
7. Apply Production migrations only from an approved release.

Direct production schema edits through a dashboard are prohibited. Destructive
changes use expand-and-contract across multiple releases.

## Backup and Recovery

Before pilot, use a paid Supabase project with daily backups and encrypted
off-platform logical exports. Initial objectives are RPO 24 hours and RTO 8
hours. Enable PITR when business data makes that RPO unacceptable. Run and
record quarterly isolated restore drills.

Supabase database backups do not include Storage objects. Storage inventory,
export, and restoration require a separate tested process.

## Data Restrictions

Only fake/demo tenant data is allowed during current development. Do not store
PHI, patient records, treatment history, diagnosis, real conversations, or
production voice recordings.

## Mandatory Evidence

- migrations reproduce the schema from zero;
- runtime credentials cannot migrate or bypass RLS;
- missing and cross-tenant context fail closed;
- concurrent updates return a conflict;
- failed transactions persist no partial business or audit state;
- backup restore completes within recorded objectives;
- query plans and connection use are measured before pilot.
