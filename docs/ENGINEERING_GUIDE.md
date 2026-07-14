# Reviva Engineering Guide

Version: 1.0

Status: Draft

Owner: Reviva Engineering Team

---

## Purpose

This guide defines how Reviva and REVOS are changed, reviewed, verified, and
documented. It applies to every contributor and coding agent working in this
repository.

Our working principle is:

> Build for the first 10 customers. Architect for the next 10,000.

## Product and Architecture Principles

- Customer value comes first. Prioritize successful AI-assisted bookings,
  reduced front-desk workload, and a better patient experience.
- Reviva is the first product; REVOS is the reusable AI Employee platform that
  supports it.
- Product needs drive REVOS capabilities. Do not build speculative platform
  features for future industries.
- Preserve clear boundaries between applications, shared packages, services,
  and infrastructure.
- Prefer simple, explicit interfaces over clever abstractions.
- Workflow and business rules must remain outside presentation components.
- AI must never access the database directly. Actions pass through controlled,
  auditable application and repository boundaries.
- Tenant context is mandatory for all organization-owned data.

## Repository Structure

```text
apps/          Deployable user-facing applications
packages/      Reusable libraries and shared configuration
services/      Independently runnable domain or platform services
docs/          Product, architecture, and engineering decisions
```

Do not introduce ambiguous folders such as `misc`, `temp`, or `new`. Organize
code by domain and responsibility. Empty directories are not retained by Git;
add them only when they contain a real file.

## Coding Standards

- Use TypeScript for web code and keep strict typing intact.
- Use Python for backend and AI services when they are introduced.
- Write code, identifiers, comments, and technical documentation in English.
- Prefer small, focused functions and components.
- Prefer composition over duplication.
- Keep business logic out of UI components.
- Use readable names that describe business meaning.
- Do not add dependencies without a concrete product or engineering need.
- Never commit secrets, credentials, customer data, generated output, or local
  environment files.

## Web and UI Standards

- Use the Next.js App Router and the existing `src` layout.
- Follow [`BRAND_SYSTEM.md`](./BRAND_SYSTEM.md) for every visual decision.
- Use semantic design tokens such as `primary`, `surface`, `foreground`, and
  `danger`; components must not depend on raw palette names.
- Build reusable primitives before duplicating markup or styling.
- Accessibility is required: keyboard access, visible focus states, semantic
  HTML, sufficient contrast, and screen-reader support where applicable.
- Keep ESLint and TypeScript free of errors and avoid unresolved warnings.

## Git Standards

- `main` is the stable primary branch.
- Keep changes small, focused, and reviewable.
- Use Conventional Commits, for example:

  ```text
  feat: add appointment availability search
  fix: prevent duplicate booking creation
  docs: add engineering quality gates
  chore: update workspace configuration
  ```

- Do not mix unrelated refactors with a feature or fix.
- Never rewrite or discard another contributor's work without explicit
  agreement.

## Quality Gates

Run checks from the repository root before every commit:

```powershell
pnpm lint
pnpm build
```

A change is ready to commit only when:

- lint succeeds;
- the production build succeeds;
- TypeScript reports no errors;
- relevant behavior has been manually verified;
- the VS Code Problems panel has no actionable project problems;
- documentation is updated when behavior, architecture, or standards change;
- `git diff --check` reports no whitespace errors;
- `git status --short` contains only intended files.

Editor diagnostics are useful, but the repository lint and production build are
the source of truth. Do not change valid application code merely to silence an
outdated editor rule; fix or document the tooling issue instead.

## Change Workflow

1. Inspect the current implementation and repository status.
2. State the business objective and acceptance criteria.
3. Make the smallest coherent change.
4. Run lint, build, and focused verification.
5. Review the diff for scope, readability, security, and architecture.
6. Update documentation when the reason or standard has changed.
7. Commit with a Conventional Commit message and push after review.

## Definition of Done

Work is done only when the implementation, tests or verification, documentation,
and review are complete. "It works on my machine" is not sufficient.

Every commit is an investment in the future of the company.
