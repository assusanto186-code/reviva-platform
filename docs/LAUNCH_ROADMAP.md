# Reviva Launch Roadmap

Version: 2.0

Status: Active

Owner: Reviva Engineering Team

---

## Objective

Launch a trustworthy AI Front Desk Employee that can communicate across text
and voice, operate with a consistent professional character, perform approved
front desk actions, and collaborate safely with med spa teams.

The launch sequence follows the repository principle:

> Build for the first 10 customers. Architect for the next 10,000.

## Product Promise

Reviva is the AI Front Desk Employee for med spas, powered by REVOS. It is not
only a chatbot. Reviva is designed to listen, speak, maintain a consistent
professional character, use tenant-approved knowledge, perform controlled
actions, and hand conversations to people when human judgment is needed.

The capability and delivery contract is defined in
[`AI_EMPLOYEE_PRODUCT_FRAMEWORK.md`](./AI_EMPLOYEE_PRODUCT_FRAMEWORK.md).
Release evidence is tracked in
[`LAUNCH_READINESS_CHECKLIST.md`](./LAUNCH_READINESS_CHECKLIST.md).
Authoritative milestone status is maintained in
[`PROJECT_STATUS.md`](./PROJECT_STATUS.md); the table below mirrors that status.

## Delivery Roadmap

| ID | Milestone | Status | Outcome |
| --- | --- | --- | --- |
| REV-001 | Platform repository foundation | Complete | A pnpm and Turborepo workspace with clear application and package boundaries. |
| REV-002 | Reviva web identity | Complete | A Next.js App Router application with Reviva product language and layout foundation. |
| REV-003 | Brand system | Complete | Documented principles for calm, premium, human, consistent, and accessible interfaces. |
| REV-004 | Engineering standards | Complete | Documented implementation workflow, quality gates, and architecture rules. |
| REV-005 | Brand-aligned UI primitives | Complete | Reusable button, badge, card, input, and container primitives based on semantic tokens. |
| REV-006 | Landing Page Foundation | Complete | A responsive, accessible public landing page that explains Reviva and provides a clear early-access path. |
| REV-007 | AI Employee product contract | Complete | Capability model, delivery phases, safety boundaries, evidence rules, and launch checklist. |
| REV-008 | Publishable web and lead capture | Complete | Validated lead submission, consent, legal pages, search readiness, and documented deployment boundaries. |
| REV-009 | Tenant and knowledge foundation | Complete | Tenant schema, transactional persistence, forced RLS, restricted runtime, immutable history, and hosted tests. |
| REV-010 | Authentication and trusted tenant context | Complete | Supabase SSR session, identity mapping, active membership, trusted context, protected shell, logout, and hosted verification. |
| REV-011 | Conversational core | REV-011A Complete; REV-011B Ready to Start | Architecture contracts and ADR-004 through ADR-006 are accepted; runtime implementation has not started. |
| REV-012 | Voice and character runtime | Planned | Real-time listening and speaking, interruption, disclosure, consent, character policy, and voice evaluations. |
| REV-013 | Controlled actions | Planned | Tenant-aware lead, availability, booking, confirmation, and notification actions through audited boundaries. |
| REV-014 | Human operations | Planned | Operator inbox, handoff, takeover, summaries, assignment, resolution, and quality review. |
| REV-015 | Security and reliability readiness | Planned | Threat model, privacy review, retention, recovery, monitoring, service objectives, and incident controls. |
| REV-016 | Design-partner pilot | Planned | Approved tenant configuration, controlled rollout, measured quality, operational learning, and customer sign-off. |
| REV-017 | Production launch | Planned | Launch approval, staged release, production support, rollback readiness, and post-launch quality cadence. |

## REV-006 — Landing Page Foundation

### Business objective

Give med spa owners and operators a clear, credible explanation of Reviva and a
low-friction way to express interest before lead capture infrastructure exists.

### Included

- responsive header and in-page navigation;
- hero messaging focused on patient responsiveness and front desk capacity;
- a representative AI conversation preview that demonstrates the experience;
- product capability, workflow, and human-handoff sections;
- an early-access call to action using an email link;
- semantic page structure, keyboard focus states, reduced-motion support, and
  sufficient contrast;
- product-specific title, description, and social metadata;
- implementation with existing design tokens and UI primitives only.

### Excluded

- lead persistence, CRM delivery, or appointment integrations;
- authenticated product experiences;
- analytics and consent management;
- customer logos, testimonials, or performance claims without evidence;
- production legal pages and policy copy.

### Acceptance criteria

- The page communicates what Reviva is, who it serves, and the core value in
  the first viewport.
- Primary and secondary actions are keyboard accessible and lead to valid
  destinations.
- Content remains usable across mobile and desktop layouts.
- The implementation uses semantic brand tokens instead of raw palette values.
- The page does not imply that a backend workflow or customer proof exists.
- `pnpm lint`, `pnpm build`, and `git diff --check` pass.

## REV-008 — Publishable Web and Lead Capture

### Implemented in the repository

- accessible early-access form with independent browser and server validation;
- explicit consent, patient-data warning, email fallback, and accessible status
  feedback;
- origin, payload-size, honeypot, timeout, and basic rate-limit controls;
- server-to-server webhook delivery with required bearer authentication and no
  false-success response on delivery failure;
- pre-launch Privacy Notice and Website Terms routes;
- canonical metadata, robots policy, sitemap, generated social image, and
  baseline response headers;
- environment contract and publishing runbook.

### Separate production-launch gates

- select and activate the production domain and Next.js-compatible host;
- configure and test a durable lead destination with a named owner;
- add provider-level spam and distributed rate-limit protection;
- obtain launch-market legal approval for privacy, terms, consent, and
  retention;
- decide whether analytics is needed and implement consent before any
  non-essential tracking;
- complete deployed accessibility, cross-browser, performance, security header,
  monitoring, and rollback verification.

REV-008 is **Complete** because its repository implementation and publishing
contract are delivered. Production delivery and deployment evidence remains
mandatory for REV-015 through REV-017 and is tracked in
`LAUNCH_READINESS_CHECKLIST.md`; it does not reopen REV-008.

## REV-009 — Tenant and Knowledge Foundation

### Implemented in the domain package

- tenant, organization, location, user, membership, and role contracts;
- mandatory tenant context and role checks for domain repositories;
- knowledge source, entry, and immutable version contracts;
- draft, publish, supersede, and rollback lifecycle rules;
- tenant-aware repository and audit interfaces;
- local in-memory test adapters explicitly marked as non-production;
- automated tests for tenant isolation, lifecycle history, permissions, and
  tenant-scoped audit events.

### Accepted architecture decisions

- Supabase Auth with membership-derived server-side `TenantContext`;
- Supabase PostgreSQL behind a vendor-independent adapter;
- Supabase Storage for approved tenant files only;
- Vercel serverless runtime using the PostgreSQL transaction pooler;
- forced RLS, restricted runtime roles, composite tenant constraints, and
  transaction-local tenant context;
- transactional knowledge lifecycle, append-only audit, and optimistic locking
  for stale operator writes.

Evidence: `docs/adr/ADR-001-authentication.md`,
`docs/adr/ADR-002-production-database.md`, and
`docs/adr/ADR-003-tenant-isolation.md`.

### Deferred follow-on work

- tenant isolation for future cache and external-search boundaries;
- operator onboarding, knowledge ingestion, review, publish, rollback, and
  freshness workflows;
- backup restore drills, operational recovery, and monitoring.

REV-009 persistence is complete: hosted migration history is synchronized and
13 REV-009 PostgreSQL isolation/lifecycle tests pass. Authentication was
completed separately in REV-010. Operator workflows, cache/search isolation,
and recovery drills remain later milestone or launch work.

## REV-010 — Authentication and Trusted Tenant Context

Implemented: pinned Supabase SSR dependencies behind a Reviva-owned auth
boundary, PKCE-compatible cookie handling, Next.js Proxy refresh, authoritative
server user validation, database identity mapping, active membership checks,
trusted `TenantContext`, restricted RLS-backed `/app`, safe callback/login, and
logout. Unit and hosted PostgreSQL integration tests pass.

Completion evidence: a fake hosted Development Auth user passed real Supabase
sign-in and `getUser` validation, identity and membership resolution, trusted
context, restricted RLS-backed access, logout, and local session invalidation.
This is hosted service integration coverage, not browser end-to-end coverage of
the Next.js routes. All 16 hosted PostgreSQL tests, hosted Auth integration,
migration synchronization, and the final Production Gate passed. See
`AUTHENTICATION.md`. REV-011A architecture is Complete; REV-011B runtime
implementation is Ready to Start through its separate execution order and has
not started.

## REV-011A — Conversation Architecture

REV-011A is an architecture and documentation milestone that is **Complete**.
It defines implementation-ready boundaries for deterministic
conversation state, principal/capability authorization, a closed tool registry,
provider-independent structured output, immutable messages/events,
expected-version concurrency, transaction/outbox/idempotency, knowledge
provenance, prompt/policy versioning, human handoff, safety, usage/audit
retention, failure taxonomy, and testing.

The design is recorded in `docs/conversation/` with accepted ADR-004 through
ADR-006 and all twelve CTO policy decisions incorporated. REV-011B is Ready to
Start only through its separate execution order and clean precondition gate;
REV-011B through REV-011G remain unimplemented. No conversation runtime,
migration, provider integration, tool engine, background worker, endpoint,
streaming UI, or booking integration has started.

## Launch Gates

REV-017 can move to complete only when:

- the early-access workflow has an accountable owner and tested delivery path;
- privacy, terms, and consent requirements have been reviewed for launch
  markets;
- accessibility and keyboard navigation have been manually verified;
- Core Web Vitals and bundle size have been measured on the production build;
- production monitoring, rollback, and incident ownership are documented;
- all public claims and customer proof have been approved.
- every required item in `LAUNCH_READINESS_CHECKLIST.md` has evidence or a
  documented, approved non-blocking exception.

## Roadmap Rules

- Status changes require implementation evidence in the repository.
- New public claims require an attributable source and approval.
- REVOS capabilities are introduced only when required by a Reviva customer
  workflow.
- Scope changes that affect architecture, privacy, or operations must be
  documented before implementation.
