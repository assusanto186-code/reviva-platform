# Reviva Project Status

Report date: 2026-07-16

Status: Active Development

Source of truth: repository state, `LAUNCH_ROADMAP.md`, and
`LAUNCH_READINESS_CHECKLIST.md`

---

## Executive Summary

Reviva has a verified public web foundation and a documented AI Employee
product direction. The repository is not yet a usable AI Employee product and
must not be represented as production-ready.

The next internal milestone is REV-009, tenant and knowledge foundation.
REV-008 remains open in parallel because its remaining work depends on external
production choices and approvals.

Current evidence count:

- 27 launch-readiness items complete;
- 69 launch-readiness items open;
- 7 roadmap milestones complete;
- 2 roadmap milestones in progress;
- 7 roadmap milestones planned.

## Repository State

- Repository: `C:\Users\hp\reviva-platform`
- Branch: `main`
- Protected domain checkpoint: `ac4b970` —
  `feat(domain): establish multi-tenant knowledge foundation`
- Protected web checkpoint: `5f20491` —
  `feat(web): establish publishable landing and lead capture`
- Baseline before this checkpoint: `533bb67`
- Most recent recorded quality evidence: root lint, root production build,
  TypeScript, five domain tests, web runtime routes, API failure behavior, and
  whitespace checks pass

The previously uncommitted feature work was reviewed and protected in coherent
Conventional Commit units. The next implementation gate is completion of the
authentication, production database, and tenant-isolation architecture decision
records. Those decisions are now accepted; production persistence may proceed
only through the adapter, migration, transaction, and isolation boundaries they
define.

## Completed Work

### REV-001 — Platform repository foundation

- pnpm workspace and Turborepo foundation;
- application, package, and service boundaries;
- root build, lint, test, and development task structure.

### REV-002 — Reviva web identity

- Next.js App Router web application;
- Reviva product identity and initial layout structure;
- semantic application entry point.

### REV-003 — Brand system

- calm, professional, trustworthy, intelligent, and premium principles;
- semantic color, typography, spacing, radius, shadow, icon, and accessibility
  direction.

### REV-004 — Engineering standards

- repository and architecture rules;
- coding, accessibility, security, Git, and quality gates;
- definition of done and change workflow.

### REV-005 — Brand-aligned UI primitives

- reusable button and button-link patterns;
- badge, card, input, and container primitives;
- visible focus and semantic token usage.

### REV-006 — Landing Page Foundation

- responsive product landing page;
- product positioning, capability, workflow, handoff, and early-access sections;
- honest labeling of planned voice and character capabilities;
- product metadata and accessible in-page navigation.

### REV-007 — AI Employee product contract

- AI Employee capability model;
- phased delivery framework from product contract to production launch;
- voice, character, action, memory, handoff, and governance boundaries;
- medical, identity, tenant, and action safety rules;
- evidence-based launch readiness checklist.

## Work in Progress

### REV-008 — Publishable web and lead capture

Implemented in the repository:

- accessible early-access form;
- independent browser and server validation;
- consent enforcement and patient-data warning;
- honeypot, origin, request-size, timeout, and basic rate-limit controls;
- authenticated HTTPS webhook delivery boundary;
- honest failure and email fallback behavior;
- Privacy Notice and Website Terms routes;
- canonical metadata, robots, sitemap, social image, and baseline headers;
- environment contract and publishing runbook;
- Vercel-specific production deployment, domain, verification, security, and
  rollback tutorial.

External blockers:

- approved production domain, Vercel Pro configuration, and live deployment;
- durable webhook or CRM endpoint, secret, and named lead owner;
- provider-level bot and distributed rate-limit controls;
- launch-market legal approval;
- production accessibility, browser, performance, monitoring, and rollback
  evidence.

REV-008 remains **In Progress** until these blockers have objective production
evidence.

## Planned Work

### REV-009 — Tenant and knowledge foundation

Domain foundation implemented:

- dependency-free `@reviva/domain` package;
- typed tenant, organization, location, user, membership, and role contracts;
- explicit tenant context and tenant-aware repository interfaces;
- knowledge source, entry, immutable version, publish, and rollback contracts;
- tenant-scoped audit contracts and local test adapters;
- five passing domain isolation, lifecycle, permission, and audit tests.

Architecture decisions completed:

- Supabase Auth selected behind a Reviva-owned infrastructure boundary;
- Supabase PostgreSQL selected behind existing domain repository interfaces;
- Supabase Storage approved only for permitted tenant files;
- membership-derived `TenantContext`, forced RLS, restricted credentials,
  transactions, optimistic locking, migration, backup, recovery, and audit
  strategies documented in `docs/adr`;
- `ARCHITECTURE.md`, `DATABASE.md`, `API_SPEC.md`, `ROADMAP.md`, and
  `SECURITY.md` establish the engineering documentation baseline.

Remaining production work:

- tenant, organization, location, membership, and role models;
- mandatory tenant context at repository boundaries;
- knowledge source, article, version, review, publish, and rollback lifecycle;
- explicit ownership, freshness, and source traceability;
- authentication, database adapter, operator workflows, and production
  tenant-isolation tests.

### REV-010 — Conversational core

- text-first orchestration, session state, safety behavior, evaluation fixtures,
  traces, latency, cost, and quality metrics.

### REV-011 — Voice and character runtime

- real-time speech input and output, interruption, turn-taking, AI disclosure,
  consent, voice configuration, and character evaluations.

### REV-012 — Controlled actions

- tenant-aware, authorized, idempotent, and auditable lead, availability,
  booking, confirmation, and notification actions.

### REV-013 — Human operations

- operator inbox, handoff, takeover, summaries, assignment, resolution, and
  quality feedback.

### REV-014 — Security and reliability readiness

- data flow, threat model, privacy, retention, recovery, monitoring, service
  objectives, provider outage, and incident controls.

### REV-015 — Design-partner pilot

- approved tenant knowledge, controlled pilot, measured quality, operational
  learning, and customer sign-off.

### REV-016 — Production launch

- go/no-go approval, staged rollout, support, rollback, incident response, and
  post-launch quality cadence.

## Execution Order

1. Build REV-009 domain contracts and tenant-isolation tests.
2. Select persistence and authentication only after the domain boundaries are
   verified.
3. Complete external REV-008 configuration when domain, host, lead destination,
   and legal owner are available.
4. Build REV-010 text-first conversational core against tenant-approved
   knowledge.
5. Add REV-011 voice only after text safety and policy behavior are measurable.
6. Add one REV-012 business action at a time through controlled boundaries.
7. Deliver operator workflows, security hardening, pilot evidence, and staged
   production launch.

## Immediate Next Slice

Completed REV-009 slices:

- create a dependency-free domain package;
- model tenants, organizations, locations, memberships, roles, knowledge
  sources, and versioned knowledge entries;
- require tenant context for every repository operation;
- provide a test repository that refuses cross-tenant reads and writes;
- test draft, publish, and rollback state transitions;
- document what remains before adding a real database or authentication system.
- accept the authentication, database, tenant-isolation, migration, backup,
  recovery, credential, and audit architecture decisions.

This slice creates verified business boundaries without pretending that an
in-memory test repository is production persistence.

The next REV-009 slice is versioned PostgreSQL migrations, a restricted runtime
role, a tenant-bound transaction coordinator, a production repository adapter,
and shared isolation tests against disposable PostgreSQL.
