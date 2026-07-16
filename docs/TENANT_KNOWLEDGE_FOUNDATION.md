# Reviva Tenant and Knowledge Foundation

Version: 1.0

Status: Domain and Architecture Foundation Implemented

Owner: Reviva Engineering

---

## Purpose

This document records the first REV-009 implementation slice. It establishes
the business contracts that persistence, authentication, operator workflows,
and conversational retrieval must obey.

Implementation: `packages/domain`

## Implemented Domain Boundaries

- opaque identifiers for tenants and tenant-owned resources;
- tenant, organization, location, user, membership, and role models;
- mandatory `TenantContext` containing tenant, actor, role, and request IDs;
- tenant access and role permission errors;
- knowledge sources with owner, location scope, source kind, URI, and freshness;
- knowledge entries with stable keys and active version references;
- immutable knowledge versions with revision, source locator, creator,
  verification, publication, and status fields;
- draft, publish, supersede, and rollback lifecycle rules;
- tenant-aware repository interfaces;
- tenant-scoped audit event contracts;
- in-memory adapters used only for local domain verification and tests.

## Invariants

1. Every organization, location, membership, knowledge source, entry, version,
   and audit event belongs to exactly one tenant.
2. Every tenant-owned repository operation receives an explicit
   `TenantContext`.
3. A context cannot write an entity owned by another tenant.
4. List and lookup operations do not return another tenant's records.
5. Agents may draft knowledge; only owners, admins, and managers may publish or
   roll back knowledge.
6. A knowledge entry has at most one published version.
7. Publishing supersedes the previous published version without changing its
   content or history.
8. Rollback creates a new revision from a previous version; it never rewrites
   historical versions.
9. Every version retains its source, creator, timestamps, and optional source
   locator and verification timestamp.
10. Audit events carry the active tenant, actor, and request identifiers.

## Verification Evidence

The domain test suite currently covers:

- organization, location, and membership isolation;
- knowledge source, entry, and version isolation;
- draft, first publish, replacement publish, and rollback;
- viewer rejection for publish operations;
- tenant-scoped, clone-protected audit events.

The in-memory adapters are test doubles. Passing these tests does not prove
database, API, cache, search index, object storage, or model-retrieval isolation.

## Production Adapter Requirements

A production persistence adapter must:

- derive tenant context from verified authentication and membership, never
  from an untrusted request body;
- include tenant ID in every tenant-owned key, index, query, update, and delete;
- enforce composite uniqueness such as tenant plus knowledge key;
- execute publish and rollback changes in a transaction;
- use optimistic concurrency or equivalent revision checks;
- keep audit storage append-only and durable;
- prevent cache and search-index keys from crossing tenants;
- test two or more tenants against every repository method;
- support retention, export, deletion, backup, and recovery requirements;
- expose health, latency, error, and audit-delivery monitoring.

## Accepted Production Architecture

- Supabase Auth behind a Reviva-owned authentication boundary;
- Supabase PostgreSQL behind a separate production repository adapter;
- server-derived membership and role resolution for `TenantContext`;
- restricted runtime database role, forced RLS, and transaction-local context;
- transactional lifecycle writes and append-only audit persistence;
- additive expected-version command envelopes for optimistic concurrency.

See `docs/adr` for the complete decisions and rejected alternatives.

## Not Yet Implemented

- authentication session and membership resolution;
- production database schema migrations and adapter;
- encrypted credential or secret storage;
- organization onboarding and membership invitation workflows;
- knowledge ingestion, review, and operator interface;
- durable transactions, concurrency control, and append-only audit storage;
- search, retrieval, chunking, or embeddings;
- production tenant-isolation, backup, recovery, and performance tests.

## Next REV-009 Slice

1. Create versioned PostgreSQL migrations and restricted database roles.
2. Implement a tenant-bound transaction coordinator.
3. Implement a production repository adapter behind the current interfaces.
4. Run shared tenant-isolation tests against that adapter.
5. Add operator workflows for source creation, drafting, review, publish, and
   rollback.
6. Add durable audit events and knowledge freshness visibility.
