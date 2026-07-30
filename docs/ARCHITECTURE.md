# Reviva Architecture

Version: 1.0

Status: Approved Foundation

Owner: Reviva Engineering

Last reviewed: 2026-07-29

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
  -> composition and delivery adapters
     -> @reviva/runtime
        -> @reviva/execution
        -> @reviva/conversation
           -> @reviva/domain
     -> @reviva/auth
     -> @reviva/postgres
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

REV-011D adds infrastructure-independent conversation persistence contracts
inside `@reviva/conversation`. Immutable event streams are authoritative;
materialized projections are rebuildable; optional snapshots accelerate replay
without changing correctness. Explicit transaction contexts coordinate event,
projection, snapshot, idempotency, outbox, and audit writes. The included
copy-on-write in-memory adapter is a deterministic contract reference only,
not durable production infrastructure.

### AI runtime

Models cannot select a tenant, grant permissions, bypass policies, or invoke an
action directly. Model output is untrusted until validated by deterministic
policy and schema boundaries.

REV-011A documents the accepted conversational boundaries under
`docs/conversation/` and accepted ADR-004 through ADR-006. REV-011B implements
the pure `@reviva/conversation` aggregate and state machine in memory. REV-011C
is Complete with deterministic capability authorization and a closed
provider-agnostic registry. REV-011D is Complete with conversation
persistence contracts and an in-memory reference adapter.

REV-011E is Complete with `@reviva/execution`, which depends on
`@reviva/conversation` and owns provider-independent inference orchestration.
It validates trusted requests, selects only declared provider/model candidates,
enforces schema, retry, repair, fallback, uncertainty, and usage policy, and
returns typed outcomes or a data-only `ToolProposal`. Providers perform
inference only and cannot authorize, mutate domain state, persist, execute
tools, or select retry/fallback policy. The deterministic scripted adapters are
test-only.

REV-011F implements the accepted `@reviva/runtime` boundary. It reconstructs
trusted runtime requests, resolves handlers from a closed registry, revalidates
authorization/confirmation/approval/handoff policy, coordinates one explicit
idempotent transaction, applies Conversation commands, and atomically records
events, projections, optional snapshots, safe audit, execution state, results,
and deferred outbox work. Its handoff service synchronizes request, acceptance,
and controlled return with the Conversation projection. Initial booking
creation and cancellation-request handlers are deterministic deferred
references only. No production persistence adapter, external worker/gateway,
real tool delivery, endpoint, streaming UI, or operator interface is included.
See `conversation/TOOL_RUNTIME.md`.

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

For AI-proposed tools, the Execution Engine emits only a data proposal. The
Tool Runtime independently revalidates current authority and state, reserves
idempotency, invokes a statically registered handler, and returns a typed
continuation. Deferred outbox acceptance is never described as delivery.

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
- REV-010 authentication is complete: hosted Development verification covers
  Supabase authentication, identity and membership resolution, trusted tenant
  context, restricted RLS-backed access, logout, and local session
  invalidation. It is not browser end-to-end coverage. REV-011A architecture and
  REV-011B pure domain implementation and REV-011C authorization are Complete.
  REV-011D, REV-011E, and REV-011F are Complete. The Release Candidate is
  Ready to Start, but its implementation has not started. AUD-005 remains
  open pending real browser/HTTP evidence.

## Decision Records

- [`ADR-001-authentication.md`](./adr/ADR-001-authentication.md)
- [`ADR-002-production-database.md`](./adr/ADR-002-production-database.md)
- [`ADR-003-tenant-isolation.md`](./adr/ADR-003-tenant-isolation.md)
- [`ADR-004-conversational-core-boundaries.md`](./adr/ADR-004-conversational-core-boundaries.md)
- [`ADR-005-capability-authorized-tool-execution.md`](./adr/ADR-005-capability-authorized-tool-execution.md)
- [`ADR-006-conversation-events-outbox-idempotency.md`](./adr/ADR-006-conversation-events-outbox-idempotency.md)
