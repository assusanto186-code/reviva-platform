# Reviva Architecture

Version: 1.0

Status: Approved Foundation

Owner: Reviva Engineering

Last reviewed: 2026-07-18

## Purpose

This document defines the system boundaries that implementations must preserve.
Architecture decisions with material tradeoffs are recorded in `docs/adr`.

## System Context

Reviva is a multi-tenant AI Employee platform for med spas. The first product is
an AI Front Desk Employee that will communicate through text and voice, use
tenant-approved knowledge, perform controlled actions, and transfer work to
human operators.

The approved first-customer stack is:

- Next.js application deployed to Vercel;
- Supabase Auth for identity;
- Supabase PostgreSQL for business persistence;
- Supabase Storage for approved tenant files;
- `@reviva/domain` for vendor-independent business contracts.

## Dependency Direction

```text
apps/web
  -> application use cases
    -> @reviva/domain
    <- infrastructure adapters
       - Supabase Auth adapter
       - PostgreSQL repository adapter
       - Supabase Storage adapter
       - external lead/action adapters
```

The domain package has no dependency on Next.js, Vercel, Supabase, PostgreSQL
drivers, AI providers, or communication providers. Infrastructure depends on
domain contracts and is replaceable behind Reviva-owned interfaces.

## Runtime Boundaries

### Public web

The current `apps/web` application serves marketing, legal, metadata, and
early-access routes. `/api/early-access` is a Node.js server boundary that
validates input and delivers an authenticated webhook. It is not tenant product
persistence.

### Authenticated application

The authenticated shell validates Supabase sessions server-side, resolves the
current Reviva user and active membership through restricted PostgreSQL,
constructs `TenantContext`, and invokes tenant-aware repositories. Browser-
provided roles or tenant IDs are never authorization. Proxy refresh is an
optimistic cookie-maintenance boundary; the server data-access layer performs
the authoritative user and membership checks for `/app`.

### Domain

`@reviva/domain` owns identifiers, models, lifecycle rules, permissions, audit
contracts, and repository interfaces. Its in-memory repositories are test
doubles only.

### Persistence

`@reviva/postgres` implements existing repository interfaces using explicit
transactions, restricted PostgreSQL credentials, forced RLS, tenant-aware
constraints, append-only audit records, and optimistic concurrency where
stale human edits can occur.

### AI runtime

REV-011 and later will introduce orchestration behind application interfaces.
Models cannot select a tenant, grant permissions, bypass policies, or invoke an
action directly. Model output is untrusted until validated by deterministic
policy and schema boundaries.

## Request Flow

1. Vercel receives an HTTPS request and assigns or propagates a request ID.
2. Public routes apply public validation; protected routes validate Auth.
3. The server resolves user, membership, tenant, and role from current data.
4. The application creates immutable `TenantContext`.
5. A transaction coordinator binds that context to restricted repositories.
6. Domain rules validate the requested transition.
7. PostgreSQL RLS and constraints independently enforce tenant ownership.
8. Business mutation and audit append commit together.
9. Responses expose only approved data and opaque support identifiers.

## Data Classification

The current development phase permits fake/demo business data and early-access
operator contact data only. Patient medical records, diagnosis, treatment
history, PHI, real customer conversations, and production voice recordings are
prohibited until a dedicated compliance milestone approves their storage and
processing.

## Architecture Gates

- Each vendor integration has a Reviva-owned interface.
- Every tenant operation receives verified `TenantContext`.
- Cross-tenant access fails at application and database boundaries.
- State changes and audit records share a transaction.
- Migrations and rollback/recovery instructions precede schema deployment.
- REV-010 authentication is complete: a real hosted Development Auth session
  was verified through restricted trusted tenant-context resolution, logout,
  and post-logout rejection. REV-011 has not started.

## Decision Records

- [`ADR-001-authentication.md`](./adr/ADR-001-authentication.md)
- [`ADR-002-production-database.md`](./adr/ADR-002-production-database.md)
- [`ADR-003-tenant-isolation.md`](./adr/ADR-003-tenant-isolation.md)
