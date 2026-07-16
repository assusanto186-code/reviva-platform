# Reviva Launch Readiness Checklist

Version: 1.0

Status: Active

Owner: Reviva Product and Engineering

---

## How to Use This Checklist

Check an item only when objective evidence exists. Add the evidence path, test
result, deployment URL, decision record, or named owner beside the item. A
feature existing in a mockup or roadmap does not make it complete.

Status definitions:

- `[x]` complete and supported by current evidence;
- `[ ]` not complete or not yet verified;
- `Blocked` requires a named dependency and owner before work can resume.

## 1. Repository and Engineering Foundation

- [x] Monorepo and package workspace exist. Evidence: root `package.json`,
  `pnpm-workspace.yaml`, and `turbo.json`.
- [x] Next.js web application exists. Evidence: `apps/web`.
- [x] Brand decisions are documented. Evidence: `docs/BRAND_SYSTEM.md`.
- [x] Engineering and quality gates are documented. Evidence:
  `docs/ENGINEERING_GUIDE.md`.
- [x] Reusable semantic UI primitives exist. Evidence:
  `apps/web/src/components/ui`.
- [x] Current root lint passes for web and domain packages. Evidence: local
  `pnpm.cmd lint` on 2026-07-15.
- [x] Current production build and TypeScript checks pass for web and domain
  packages. Evidence: local `pnpm.cmd build` on 2026-07-15.
- [x] Automated domain unit tests run through the root test task. Evidence:
  `packages/domain/test/domain.test.mjs` and local `pnpm.cmd test` on
  2026-07-15.
- [ ] Web integration and end-to-end test layers are configured.
- [ ] Continuous integration runs required quality gates for every change.
- [ ] Dependency, secret, and vulnerability scanning are configured.

## 2. Product Contract

- [x] Reviva is defined as an AI Front Desk Employee for med spas. Evidence:
  root `README.md` and `docs/AI_EMPLOYEE_PRODUCT_FRAMEWORK.md`.
- [x] The AI Employee capability model is documented. Evidence:
  `docs/AI_EMPLOYEE_PRODUCT_FRAMEWORK.md`.
- [x] Voice and character are explicitly part of the product direction.
  Evidence: `docs/AI_EMPLOYEE_PRODUCT_FRAMEWORK.md`.
- [x] Medical, identity, action, tenant, and handoff boundaries are documented.
  Evidence: `docs/AI_EMPLOYEE_PRODUCT_FRAMEWORK.md`.
- [ ] First-customer profile and launch market are approved.
- [ ] Priority consumer journeys and acceptance thresholds are approved.
- [ ] Character contract, vocabulary, pronunciation, and escalation style are
  approved by Product.
- [ ] Supported launch channels are selected.
- [ ] Product success, safety, reliability, latency, and cost metrics have
  numeric targets.

## 3. Public Web Experience

- [x] Responsive landing page foundation is implemented. Evidence:
  `apps/web/src/app/page.tsx`.
- [x] Product metadata replaces framework placeholder metadata. Evidence:
  `apps/web/src/app/layout.tsx`.
- [x] Public copy avoids unsupported customer logos, testimonials, and numeric
  performance claims.
- [x] Early access has a valid email fallback and reports success only after
  the configured delivery service accepts the submission.
- [x] Lead form browser validation, server validation, consent enforcement,
  request-size limit, honeypot, origin check, and basic rate limiting exist.
  Evidence: `apps/web/src/components/marketing/early-access-form.tsx` and
  `apps/web/src/app/api/early-access/route.ts`.
- [x] An authenticated HTTPS webhook delivery boundary and payload contract
  exist. Evidence: `apps/web/src/lib/leads.ts` and
  `docs/WEB_PUBLISHING_RUNBOOK.md`.
- [ ] Production webhook durably stores submissions and delivers them to a
  named owner end to end.
- [ ] Lead consent copy and retention policy are approved.
- [x] Pre-launch Privacy Notice and Website Terms routes are implemented.
  Evidence: `apps/web/src/app/privacy` and `apps/web/src/app/terms`.
- [ ] Privacy Notice, Website Terms, consent copy, and required disclosures have
  legal approval for the launch market.
- [x] No non-essential analytics or advertising cookies are currently loaded.
- [ ] Analytics requirements and consent behavior are approved and verified if
  non-essential analytics are introduced.
- [x] Sitemap, robots policy, canonical URL, and generated social sharing image
  exist. Evidence: metadata files in `apps/web/src/app`.
- [x] Baseline content-type, framing, referrer, and permissions headers are
  configured. Evidence: `apps/web/next.config.ts`.
- [ ] Custom domain and production deployment are active.
- [ ] Accessibility audit passes with no launch-blocking findings.
- [ ] Cross-browser and mobile-device QA passes.
- [ ] Production performance and security header checks pass.

## 4. Tenant and Knowledge Foundation

- [x] Organization, location, user, membership, role, and tenant domain models
  are defined. Evidence: `packages/domain/src/models.ts`.
- [x] Domain repository interfaces and local adapters require explicit tenant
  context. Evidence: `packages/domain/src/repositories.ts` and
  `packages/domain/src/memory-repositories.ts`.
- [ ] Authentication-derived tenant context is enforced at every production
  repository, cache, search, API, and action boundary.
- [x] Automated domain tests prove local repository test doubles do not return
  or write another tenant's records. Evidence:
  `packages/domain/test/domain.test.mjs`.
- [ ] Shared isolation tests pass against production persistence, cache, and
  search adapters.
- [ ] Operators can ingest, review, publish, version, and roll back knowledge.
- [x] Domain rules support draft, publish, supersede, and immutable rollback
  transitions with role checks. Evidence:
  `packages/domain/src/knowledge-lifecycle.ts`.
- [ ] Services, policies, hours, locations, and approved answers have explicit
  sources.
- [x] Knowledge contracts retain source, owner, location scope, source locator,
  creator, verification time, and publication history.
- [ ] Knowledge freshness and ownership are visible in an operator workflow.
- [ ] Secrets are stored outside source control and scoped per environment.

## 5. Conversational Core

- [ ] Conversation sessions and state transitions are defined.
- [ ] Text conversations support priority med spa journeys end to end.
- [ ] AI identity disclosure is present at the required moments.
- [ ] Unsupported and ambiguous requests fail safely.
- [ ] Medical and urgent-language behavior is evaluated.
- [ ] Conversation traces record model, prompt, knowledge version, actions,
  latency, and outcome without exposing unnecessary sensitive data.
- [ ] Evaluation fixtures cover happy paths, edge cases, abuse, and regression.
- [ ] Model cost, latency, error, and quality metrics are observable.

## 6. Voice and Character

- [ ] Voice channel and provider decision is documented with latency, privacy,
  reliability, language, cost, and portability tradeoffs.
- [ ] Streaming speech input and output work on supported devices.
- [ ] Users can interrupt, resume, and end a conversation naturally.
- [ ] Silence, noise, dropped connection, and transcription failure are handled.
- [ ] AI disclosure and recording consent are approved for each launch market.
- [ ] Voice, tone, vocabulary, pronunciation, pacing, and prohibited behaviors
  are versioned as a character contract.
- [ ] Text and voice pass the same business, safety, and escalation evaluations.
- [ ] Voice latency and intelligibility meet approved numeric targets.
- [ ] A human can disable voice immediately during an incident.

## 7. Controlled Actions and Integrations

- [ ] Lead creation is schema-validated, tenant-aware, and auditable.
- [ ] Availability lookup uses an approved integration boundary.
- [ ] Booking requests require explicit customer confirmation.
- [ ] Duplicate submissions and retries are idempotent where required.
- [ ] Action permissions are enforced outside the model.
- [ ] Integration timeout and failure never produce a false success message.
- [ ] Action audit events support investigation and customer support.
- [ ] Credentials can be rotated without code changes.

## 8. Human Operations

- [ ] Handoff triggers and priority levels are documented.
- [ ] Operators receive the full relevant context and a reviewable summary.
- [ ] Assignment, takeover, resolution, and return-to-AI flows work.
- [ ] Response ownership and service expectations are documented.
- [ ] Unsafe or incorrect interactions can be flagged for review.
- [ ] Support, incident, data request, and deletion workflows have named owners.

## 9. Security, Privacy, and Reliability

- [ ] Data inventory and data-flow diagram are reviewed.
- [ ] Authentication, authorization, tenant isolation, and audit tests pass.
- [ ] Encryption and key-management responsibilities are documented.
- [ ] Retention, export, deletion, backup, and recovery are tested.
- [ ] Market-specific legal and privacy review is complete.
- [ ] Threat model and penetration test have no unresolved launch blockers.
- [ ] Service objectives, health checks, alerts, and on-call ownership are active.
- [ ] Rollback, provider outage, degraded mode, and channel shutdown are tested.

## 10. Pilot and Production Launch

- [ ] Internal simulation passes all priority journeys.
- [ ] Design-partner tenants approve their knowledge and escalation rules.
- [ ] Pilot feedback, failures, and overrides are reviewed on a fixed cadence.
- [ ] Quality and reliability thresholds pass for the agreed pilot period.
- [ ] Launch go/no-go review has named Product, Engineering, Operations,
  Security, and Support approvers.
- [ ] Staged rollout, rollback, incident communication, and support runbooks are
  approved.
- [ ] Production launch is complete.
- [ ] Post-launch quality review and customer feedback cadence are active.

## Current Release Decision

**Not ready to publish as a usable AI Employee.** The marketing foundation is
implemented, but lead capture, tenant infrastructure, conversational runtime,
voice, controlled actions, human operations, security review, deployment, and
pilot evidence remain open.
