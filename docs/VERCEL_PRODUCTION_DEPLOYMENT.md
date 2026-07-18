# Reviva Production Deployment on Vercel

Version: 1.0

Status: Deployment Tutorial Complete, Production Configuration Pending

Owner: Reviva Engineering and Operations

Last reviewed: 2026-07-15

---

## Purpose

This tutorial describes how to publish the Reviva web application from the
existing monorepo, connect a production domain, activate lead delivery, verify
the release, and roll it back safely.

It complements `WEB_PUBLISHING_RUNBOOK.md`. It does not authorize a commit,
push, DNS change, purchase, or production deployment. Complete those actions
only with the appropriate repository, domain, billing, legal, and operations
owners.

## Recommended Production Shape

| Concern | Reviva configuration |
| --- | --- |
| Vercel plan | Pro for a commercial Reviva deployment |
| Vercel project | `reviva-web` |
| Git repository | Import the complete `reviva-platform` repository |
| Root Directory | `apps/web` |
| Framework | Next.js, detected automatically |
| Package manager | pnpm from the root lockfile and `packageManager` field |
| Node.js | 24.x |
| Production branch | `main` |
| Production domain | One approved canonical HTTPS origin |
| Dynamic runtime | Next.js Node.js runtime for `/api/early-access` |

Vercel Hobby is limited to personal, non-commercial use. Reviva is intended to
be a commercial product, so use a Pro team and configure spend notifications
before public traffic is enabled.

## Phase 0 — Obtain the Required Access and Decisions

Before configuring Vercel, confirm that the release owner has:

- access to the Git provider containing the Reviva repository;
- permission to create a Vercel project and manage its billing;
- access to the domain registrar or DNS provider;
- an approved primary domain, for example `reviva.example` or
  `www.reviva.example`;
- a production HTTPS webhook or CRM endpoint for early-access leads;
- a high-entropy webhook secret and a named operational lead owner;
- legal approval for the Privacy Notice, Website Terms, and consent copy.

Do not publish the current working tree directly. Review the existing changes,
split them into coherent commits, and send them through the agreed review flow
before connecting production to `main`.

## Phase 1 — Prepare a Release Candidate

From the repository root, run:

```powershell
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd test
git diff --check
git status --short
```

Then create or update a review branch, commit only the intended files, push it,
and obtain approval. A pull request or non-production branch provides a Vercel
Preview deployment; merging to the configured production branch creates a
Production deployment.

Record the commit SHA used for every production release. Never depend on
uncommitted local files, because Vercel deploys the contents available through
the connected Git repository.

## Phase 2 — Create the Vercel Project

1. Create or select the Reviva Vercel team.
2. Select **Add New → Project**.
3. Connect the approved Git provider and import the complete
   `reviva-platform` repository. Do not clone or recreate it in Vercel.
4. Set the project name to `reviva-web`.
5. Set **Root Directory** to `apps/web`.
6. Confirm that the framework preset is **Next.js**.
7. Leave **Install Command**, **Build Command**, and **Output Directory** on
   their detected defaults for the first build.
8. In Project Settings, select Node.js **24.x**.
9. In Git settings, confirm that the Production Branch is `main`.

Vercel should discover the root `pnpm-lock.yaml` and the repository declaration
`"packageManager": "pnpm@11.10.0"`. Check the first build log to confirm that
pnpm 11.10.0 is actually used. Do not override the install command with a bare
`pnpm install` unless there is a verified build problem.

When the web app starts importing workspace packages, declare every package as
an explicit dependency in `apps/web/package.json`, for example
`"@reviva/domain": "workspace:*"`. A workspace package merely existing in the
repository is not an application dependency.

## Phase 3 — Configure Environment Variables

Open **Project Settings → Environment Variables**. Add these variables to the
Production environment:

| Variable | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.reviva.example` | Exact canonical origin, without a trailing slash |
| `LEAD_WEBHOOK_URL` | `https://crm.example/hooks/reviva` | HTTPS endpoint that durably accepts the lead event |
| `LEAD_WEBHOOK_SECRET` | generated secret | Server-only bearer credential; never expose it to the browser |
| `LEAD_ALLOWED_ORIGIN` | `https://www.reviva.example` | Must exactly match the browser origin, including `www` choice |

Important rules:

- never paste secrets into source code, screenshots, tickets, or chat;
- use separate webhook credentials and destinations for Preview and Production;
- do not send test leads from Preview into the live CRM pipeline;
- redeploy after changing variables, because changes do not alter an existing
  deployment;
- rotate `LEAD_WEBHOOK_SECRET` after suspected exposure or staff handover.

The API currently checks one exact `LEAD_ALLOWED_ORIGIN`. Random generated
Preview URLs therefore cannot all share one static value. For repeatable QA,
assign a stable preview domain such as `preview.reviva.example` to the review
branch and use that exact origin in Preview environment variables. Otherwise,
expect lead requests from other Preview origins to return `403`.

## Phase 4 — Deploy and Verify Preview

Create or update a non-production branch or pull request. Wait for the Vercel
Preview deployment to finish, then inspect the build log for dependency,
framework, Node.js, and route errors.

Verify these routes on the Preview URL:

- `/`;
- `/privacy`;
- `/terms`;
- `/robots.txt`;
- `/sitemap.xml`;
- `/opengraph-image`.

Test the early-access workflow with non-sensitive test data:

1. Invalid input returns `400` and explains what must be corrected.
2. A request from an unapproved origin returns `403`.
3. Missing or invalid webhook configuration returns `503`; the UI must not
   claim success.
4. A valid request returns `201` only after the receiving system has durably
   accepted it.
5. The receiving system stores the `requestId`, rejects duplicate delivery,
   and routes the lead to the named owner.
6. Application and provider logs do not contain the submitted lead fields.

Also test keyboard navigation, visible focus, mobile layout, supported browsers,
and the email fallback. Record the Preview URL, commit SHA, tester, timestamp,
and results as release evidence.

## Phase 5 — Add the Production Domain

You can register a new domain through Vercel or use a domain from an existing
registrar. Domain purchase and naming require explicit business-owner approval.

For an existing domain:

1. Open **Project Settings → Domains**.
2. Select **Add Domain** and enter the approved domain.
3. Add both the apex domain and `www` variant when both should resolve.
4. Select one canonical host. Configure the other host to redirect permanently
   to it.
5. At the registrar or DNS provider, add the exact records shown in the Vercel
   dashboard.
6. Remove only confirmed conflicting records for the same host. Preserve mail
   records such as MX, SPF, DKIM, and DMARC.
7. Wait until Vercel reports the domain as configured and the TLS certificate
   is active.

An apex domain normally uses an A record and a subdomain such as `www` normally
uses a CNAME. Vercel publishes general-purpose values, but a project can receive
specific values. Treat the dashboard or `vercel domains inspect <domain>` as
the source of truth instead of copying generic DNS values from a tutorial.

After choosing the canonical domain:

1. Set `NEXT_PUBLIC_SITE_URL` and `LEAD_ALLOWED_ORIGIN` to that exact HTTPS
   origin.
2. Confirm that the webhook allowlist, if present, accepts production traffic.
3. Create a new Production deployment so the updated variables take effect.
4. Verify that the non-canonical host redirects to the canonical host without a
   redirect loop.

DNS changes can take time to propagate. Do not repeatedly replace records while
propagation is still in progress; first inspect the authoritative DNS response
and the Vercel domain status.

## Phase 6 — Add Production Protection

Before broad promotion:

- enable Vercel spend management, notifications, and an owner for usage alerts;
- protect Preview deployments from unintended public access;
- enable Vercel bot protection appropriate to the selected plan;
- create a Vercel Firewall rate-limit rule for `POST /api/early-access`;
- select a conservative initial request threshold, observe legitimate traffic,
  and tune it using evidence;
- retain the application-level validation, honeypot, origin, size, timeout, and
  rate-limit controls as defense in depth;
- configure production error and availability alerts with an on-call owner.

The application's in-memory limiter is per runtime instance and is not a
distributed production control. Provider-level or shared rate limiting remains
mandatory before a public campaign.

## Phase 7 — Release to Production

1. Confirm that the release candidate and legal copy are approved.
2. Merge the reviewed change to `main`.
3. Observe the Vercel Production deployment until it is ready.
4. Repeat all route and form smoke tests on the canonical domain.
5. Inspect canonical metadata, robots, sitemap, social image, TLS, redirects,
   security headers, and mobile rendering.
6. Confirm that one controlled production lead is durably stored and reaches
   the named owner.
7. Confirm alerts, logs, and the rollback owner.
8. Record the domain, deployment URL, commit SHA, test evidence, approvers, and
   deployment time in `LAUNCH_READINESS_CHECKLIST.md`.

A successful Vercel build is not sufficient launch evidence. REV-008 repository
implementation is complete, while domain activation, lead delivery, legal,
accessibility, browser, performance, monitoring, and rollback evidence remain
mandatory REV-015 through REV-017 launch gates.

## Rollback Procedure

If the site or lead path is unsafe:

1. Stop promotional traffic.
2. In Vercel Deployments, select the last verified Production deployment and
   use **Rollback**, or use `vercel rollback` from an authorized environment.
3. Verify the canonical domain after rollback.
4. If lead delivery is the problem, remove `LEAD_WEBHOOK_URL` and redeploy. The
   current UI will use the honest email fallback instead of returning false
   success.
5. Rotate `LEAD_WEBHOOK_SECRET` if credential exposure is possible.
6. Preserve request IDs and operational evidence without copying lead contents
   into incident channels.
7. Document impact, decision owner, rollback deployment, and follow-up action.

Vercel Pro supports selecting an earlier deployment for rollback; plan limits
can differ, so verify the available rollback target before the launch window.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Vercel cannot resolve workspace dependencies | Only the app folder was imported, or a dependency is undeclared | Import the complete repository, keep Root Directory `apps/web`, and declare workspace dependencies explicitly |
| Unexpected pnpm version | Install command override or package-manager detection issue | Restore automatic install detection and inspect the root lockfile and `packageManager` field in the build log |
| Lead request returns `503` | Webhook URL/secret missing, rejected, timed out, or did not durably accept | Check server variables and receiving-system logs by request ID |
| Lead request returns `403` | `LEAD_ALLOWED_ORIGIN` does not exactly match the browser origin | Correct protocol, apex/`www`, and Preview/Production environment scope; redeploy |
| Canonical links use the wrong host | `NEXT_PUBLIC_SITE_URL` is wrong or the deployment predates the change | Correct the variable and redeploy |
| Domain remains pending | Incorrect, conflicting, or unpropagated DNS record | Use the exact Vercel record, inspect authoritative DNS, and preserve unrelated mail records |
| Build succeeds but form fails | Static pages work while the dynamic webhook boundary is misconfigured | Inspect `/api/early-access`, environment variables, firewall rules, and webhook delivery |

## Completion Checklist

### Account and repository

- [ ] Vercel Pro team and billing owner approved.
- [ ] Spend notifications and response owner configured.
- [ ] Intended Reviva changes reviewed, committed, and pushed.
- [ ] Vercel imports the existing complete repository.
- [ ] Root Directory is `apps/web`.
- [ ] Production branch is `main`.
- [ ] Build log confirms Next.js, Node.js 24.x, and pnpm 11.10.0.

### Configuration and preview

- [ ] Production and Preview variables use separate approved values.
- [ ] Webhook secret is stored only in Vercel and the receiving system.
- [ ] Stable Preview origin is configured for end-to-end lead testing.
- [ ] Preview route, accessibility, browser, form, and failure tests pass.
- [ ] Valid Preview delivery is durable and reaches its named test owner.

### Domain and security

- [ ] Domain and canonical apex/`www` decision approved.
- [ ] Exact Vercel DNS records are active.
- [ ] TLS is active and the alternate host redirects correctly.
- [ ] Canonical URL and allowed origin match the production domain exactly.
- [ ] Firewall rate limiting and bot protection are active.
- [ ] Monitoring, alerts, and rollback owner are active.

### Production evidence

- [ ] Production deployment from an approved `main` commit succeeds.
- [ ] Public routes, metadata, TLS, redirects, and headers pass smoke testing.
- [ ] Controlled production lead is durably stored and reaches its owner.
- [ ] Legal, accessibility, browser, and performance approvals are recorded.
- [ ] Rollback is tested or rehearsed and evidence is recorded.
- [ ] `LAUNCH_READINESS_CHECKLIST.md` contains links to objective evidence.

## Official Vercel References

- [Vercel plans](https://vercel.com/docs/plans)
- [Hobby plan restrictions](https://vercel.com/docs/plans/hobby)
- [Importing monorepos](https://vercel.com/docs/monorepos)
- [Git deployments](https://vercel.com/docs/git)
- [Environment variables](https://vercel.com/docs/environment-variables)
- [Deployment environments](https://vercel.com/docs/deployments/environments)
- [Project settings](https://vercel.com/docs/project-configuration/project-settings)
- [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Package managers](https://vercel.com/docs/package-managers)
- [Adding a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Custom-domain DNS setup](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel Firewall](https://vercel.com/docs/vercel-firewall)
- [Rate limiting](https://vercel.com/kb/guide/add-rate-limiting-vercel)
- [Production rollback](https://vercel.com/docs/deployments/rollback-production-deployment)
