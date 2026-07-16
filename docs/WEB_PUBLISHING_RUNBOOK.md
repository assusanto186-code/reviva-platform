# Reviva Web Publishing Runbook

Version: 1.0

Status: Implementation Complete, Production Configuration Pending

Owner: Reviva Engineering and Operations

---

## Purpose

This runbook describes how to publish the Reviva marketing site and activate
the early-access workflow introduced in REV-008.

The application contains a dynamic `POST /api/early-access` Route Handler. The
deployment target must support the Next.js Node.js runtime or an equivalent
serverless adapter. A static-file-only host cannot deliver lead submissions.

## Required Configuration

Use `apps/web/.env.example` as the variable contract. Store production values
in the deployment platform's secret manager, never in source control.

| Variable | Visibility | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | Yes | Canonical HTTPS origin used for metadata, robots, and sitemap. |
| `LEAD_WEBHOOK_URL` | Server only | Yes | HTTPS endpoint that persists and routes accepted lead events. |
| `LEAD_WEBHOOK_SECRET` | Server only | Yes | Bearer credential used to authenticate Reviva to the webhook. |
| `LEAD_ALLOWED_ORIGIN` | Server only | Yes | Exact public browser origin allowed to submit the form. |

## Lead Delivery Contract

Reviva sends an HTTPS `POST` request with:

- `content-type: application/json`;
- `x-reviva-event: early_access.requested`;
- `x-reviva-request-id: <uuid>`;
- `authorization: Bearer <LEAD_WEBHOOK_SECRET>`.

Payload shape:

```json
{
  "event": "early_access.requested",
  "requestId": "uuid",
  "submittedAt": "ISO-8601 timestamp",
  "source": "reviva-landing-page",
  "lead": {
    "name": "string",
    "workEmail": "string",
    "spaName": "string",
    "role": "owner | manager | front-desk | marketing | other",
    "website": "string",
    "message": "string",
    "consent": true
  }
}
```

The receiving system must persist the request ID, enforce idempotency on that
ID, timestamp receipt, protect access, define retention, and route the lead to a
named owner. It must return a `2xx` status only after durable acceptance. Reviva
never tells the user that delivery succeeded when the webhook fails.

## Built-in Application Controls

- required browser validation and independent server validation;
- consent required before delivery;
- a hidden honeypot field for basic bot filtering;
- a 20 KB request-size limit;
- exact-origin verification;
- best-effort in-memory rate limiting;
- an eight-second delivery timeout;
- HTTPS-only remote webhook configuration;
- request IDs for support correlation without logging lead contents;
- email fallback when delivery is unavailable;
- API routes excluded from search indexing;
- baseline content-type, framing, referrer, and permissions headers.

The in-memory rate limit is not sufficient across multiple serverless instances.
Production must add provider-level rate limiting, bot protection, or a durable
shared limiter before broad promotion.

## Deployment Procedure

1. Choose the production domain and a Next.js-compatible host.
2. Create a production lead destination with a named operational owner.
3. Configure all required variables in preview and production environments.
4. Restrict the webhook to HTTPS and authenticate it with a rotated secret.
5. Run `pnpm.cmd --filter web lint` and `pnpm.cmd --filter web build`.
6. Deploy a preview and verify `/`, `/privacy`, `/terms`, `/robots.txt`,
   `/sitemap.xml`, and `/opengraph-image`.
7. Submit invalid, honeypot, valid, duplicate, rate-limited, and simulated
   webhook-failure requests.
8. Confirm a valid submission is durably stored and reaches the named owner.
9. Review public legal text, domain, metadata, and consent behavior.
10. Promote to production, repeat the smoke test, and record evidence in
    `LAUNCH_READINESS_CHECKLIST.md`.

## Rollback and Incident Controls

- Roll back to the previous verified deployment when the public site fails.
- Remove `LEAD_WEBHOOK_URL` to stop outbound lead delivery; the UI will show the
  email fallback instead of a false success.
- Rotate `LEAD_WEBHOOK_SECRET` if delivery credentials may be exposed.
- Disable or rate-limit `/api/early-access` at the hosting edge during abuse.
- Use request IDs to correlate browser reports with webhook receipt records.
- Do not include submitted lead fields in application logs or incident chats.

## Production Evidence Still Required

- approved domain and deployment URL;
- preview and production environment owners;
- webhook or CRM owner and tested durable delivery;
- provider-level spam and rate-limit controls;
- legal approval for Privacy Notice, Website Terms, and consent copy;
- accessibility, cross-browser, performance, and security header reports;
- analytics decision and consent implementation if non-essential analytics are
  introduced;
- monitoring, alerts, and rollback drill results.
