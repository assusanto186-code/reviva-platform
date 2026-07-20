# Reviva Security Standard

Version: 1.0

Status: Approved Foundation

Owner: Reviva Engineering and Security

Last reviewed: 2026-07-16

## Security Objectives

Reviva must protect tenant boundaries, credentials, operator identities,
approved knowledge, action integrity, audit evidence, and service availability.
Security controls fail closed and are verified with objective evidence.

## Current Data Boundary

Development and Preview environments use fake/demo data only. Do not store or
process patient medical records, diagnosis, treatment history, PHI, real
customer conversations, or production voice recordings. Early-access data is
limited to med spa operator contact and workflow information with consent.

HIPAA readiness requires a dedicated milestone covering data flows, minimum
necessary use, vendor agreements, access controls, retention, deletion,
incident response, and independent review. The current architecture must not be
represented as HIPAA compliant.

## Identity and Authorization

- Supabase Auth validates identity; Reviva memberships authorize tenant access.
- `TenantContext` is constructed server-side from current user and membership
  data.
- Client-supplied tenant IDs and roles are lookup hints, never authority.
- MFA is mandatory for owner/admin roles before pilot.
- Sensitive operations require recent `aal2` authentication.
- Disabled users, inactive memberships, and suspended tenants fail closed.
- Supabase SSR tokens remain in PKCE-compatible cookies; application code does
  not store tokens in local storage or log them. Proxy refresh is not treated
  as authoritative server-side user validation.
- Login errors are generic and callback redirects are restricted to `/app`.

## Tenant Isolation

- Every tenant repository operation requires `TenantContext`.
- Every tenant table uses mandatory tenant IDs, forced RLS, and tenant-aware
  constraints.
- Runtime database roles cannot own tables or bypass RLS.
- Tenant state is set transaction-locally to prevent pooled-connection leakage.
- Cache, storage, search, jobs, exports, and audit access include tenant scope.
- Cross-tenant tests are mandatory against production-equivalent persistence.

## Credential Management

- Store secrets only in approved environment secret managers.
- Use separate credentials for Development, Preview, and Production.
- Never expose database, Supabase secret/service-role, webhook, or signing
  credentials through `NEXT_PUBLIC_*`, client code, logs, fixtures, or docs.
- Prefer opaque Supabase publishable/secret keys over legacy JWT API keys.
- Separate runtime, migration, administrative, and external-service credentials.
- Assign an owner, least privilege, rotation schedule, and emergency revocation
  process to every credential.

## Application and API Security

- Validate schemas independently on server boundaries.
- Enforce HTTPS, request-size limits, timeouts, rate limits, and safe failures.
- Use idempotency and explicit confirmation for consequential actions.
- Never claim success until durable acceptance is proven.
- Apply secure response headers and provider-level bot/abuse controls.
- Pin and review high-risk authentication and persistence dependencies.
- Prevent protected data from entering URLs, analytics, exception messages, or
  support chats.

## Database and Audit Security

- Use reviewed migrations only; prohibit untracked production schema edits.
- Commit business mutations and audit appends atomically.
- Make audit records append-only for runtime roles.
- Use optimistic locking or row locks to prevent silent lost updates.
- Encrypt connections and backups; restrict restore and export access.
- Test backup restoration and credential replacement in isolation.

Implemented persistence safeguards now include a restricted `reviva_app` role,
forced RLS, tenant-aware foreign keys and indexes, a security-definer context
validator, transaction-local context, tenant ownership triggers, immutable
knowledge content/provenance, and append-only runtime audit permissions. These
controls were verified against the hosted Supabase Development database on
2026-07-17. The runtime login is not a superuser, does not inherit, cannot
create roles or databases, cannot create in the database or public schema, and
does not have `BYPASSRLS`. Cross-tenant and administrative attempts fail.
The REV-010 identity resolver exposes only minimum mapping fields to
`reviva_app`; the role still cannot select `users` directly.

Hosted integration tests require explicit Development environment and project
identity variables, distinct administration/runtime credentials, and a
Development-only confirmation. A declared Production project ref matching the
test ref is rejected.

## AI and Voice Safety

- Models do not authorize users, select tenants, or invoke raw credentials.
- Model output is untrusted and schema/policy validated.
- Approved tenant knowledge is the source for business answers.
- Medical diagnosis, clinical advice, and unsupported certainty are prohibited.
- Voice requires AI disclosure, recording consent decisions, interruption,
  shutdown controls, and approved retention before production use.
- Human handoff is required for judgment, safety, complaints, and unsupported
  requests.

## REV-011B Conversation-domain Controls

`@reviva/conversation` is a pure in-memory boundary. It accepts no provider,
database, HTTP, browser, or booking-integration type. Every mutation requires a
typed command and exact aggregate version, emits one immutable event, and
changes projection only through event application. Booking creation and material
modification require matching patient confirmation; autonomous cancellation is
prohibited. Handoff pauses AI effects, and stale AI, confirmation, and tool
results fail closed.

The web Auth configuration now validates a Supabase project root origin without
normalizing or mutating it. Route-function and hosted Auth verification remain
green. The AUD-005 domain requirement is satisfied. Full browser/HTTP Auth
journey coverage remains an explicitly tracked web-integration acceptance gate
pending an approved harness; AUD-005 is therefore not claimed as fully closed.

## Vulnerability and Incident Handling

Security findings must record severity, affected boundary, owner, containment,
fix, verification, and disclosure decision. Suspected credential exposure
triggers rotation. Suspected cross-tenant access stops affected traffic and
preserves safe audit evidence. Lead or conversation payloads must not be copied
into incident channels.

Before pilot, establish dependency/secret scanning, provider alerts, service
health monitoring, on-call ownership, rollback procedures, and a documented
incident communication path.

## Required Evidence Before Pilot

- reviewed threat model and data-flow inventory;
- authentication and MFA tests;
- PostgreSQL RLS and cross-tenant isolation tests;
- runtime credential privilege tests;
- audit immutability and transaction rollback tests;
- dependency, secret, and vulnerability scan results;
- restore drill and incident simulation;
- legal/privacy decision for every collected data class;
- no prohibited real data in Development or Preview.

## Related Decisions

- [`ADR-001-authentication.md`](./adr/ADR-001-authentication.md)
- [`ADR-002-production-database.md`](./adr/ADR-002-production-database.md)
- [`ADR-003-tenant-isolation.md`](./adr/ADR-003-tenant-isolation.md)
- [`ADR-004-conversational-core-boundaries.md`](./adr/ADR-004-conversational-core-boundaries.md)
- [`ADR-005-capability-authorized-tool-execution.md`](./adr/ADR-005-capability-authorized-tool-execution.md)
- [`ADR-006-conversation-events-outbox-idempotency.md`](./adr/ADR-006-conversation-events-outbox-idempotency.md)
