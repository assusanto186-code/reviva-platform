# Reviva API Specification

Version: 1.0

Status: Public Lead API and Authentication Routes Implemented; Product APIs Pending

Owner: Reviva Engineering

Last reviewed: 2026-07-18

## Conventions

- HTTPS only outside local development.
- JSON request and response bodies unless documented otherwise.
- UUID request IDs for correlation.
- Explicit schema validation at every external boundary.
- No false-success responses when durable work fails.
- Protected APIs derive identity and tenant context server-side.
- Errors expose safe reason codes and do not expose credentials, SQL, or tenant
  data.

## POST `/api/early-access`

Purpose: accept operator interest from the public marketing site and deliver it
to an authenticated HTTPS webhook.

Authentication: public browser endpoint with exact-origin, honeypot, size, and
rate-limit controls. The downstream webhook uses a bearer secret.

Request body:

```json
{
  "name": "Jordan Lee",
  "workEmail": "jordan@example.com",
  "spaName": "Example Med Spa",
  "role": "owner",
  "website": "https://example.com",
  "message": "We need help with inquiry follow-up.",
  "contactFax": "",
  "consent": true
}
```

`role` is one of `owner`, `manager`, `front-desk`, `marketing`, or `other`.
The form must not contain patient or medical information.

Responses:

| Status | Meaning |
| --- | --- |
| `201` | Lead durably accepted by the configured destination |
| `202` | Honeypot submission intentionally acknowledged without delivery |
| `400` | JSON or field validation failed |
| `403` | Request origin is not approved |
| `413` | Declared body size exceeds the limit |
| `429` | Request rate exceeded |
| `502` | Configured destination failed or timed out |
| `503` | Lead delivery is not configured |

Successful delivery returns `success: true` and a request ID. Validation errors
may include a `fieldErrors` object. Lead values are not written to application
logs.

The downstream event contract is documented in
[`WEB_PUBLISHING_RUNBOOK.md`](./WEB_PUBLISHING_RUNBOOK.md).

## Future Authenticated APIs

The current web authentication surface is page/route based:

| Route | Boundary |
| --- | --- |
| `GET/POST /login` | Generic credential sign-in response; safe `/app` redirect only |
| `GET /auth/callback` | PKCE code exchange; missing/invalid code fails to `/login` |
| `GET /app` | Server-validated session, active Reviva identity and membership required |
| `POST /app` logout action | Clears the local Supabase session and returns to `/login` |

These routes never accept tenant or role claims as authority and expose no
internal user, tenant, or membership identifiers.

Product APIs are not implemented or stable. Before adding a route, define:

- actor and required roles;
- tenant-context resolution;
- request, response, and error schemas;
- idempotency and optimistic-concurrency behavior;
- transaction and audit behavior;
- pagination, filtering, and resource limits;
- privacy classification and retention;
- authorization, isolation, failure, and abuse tests.

Initial resource groups are expected to cover tenant selection, memberships,
knowledge sources, knowledge drafts, publish/rollback, and audit review. Their
paths are intentionally not reserved until the application use cases and
production repository adapter are verified.

## API Change Policy

Breaking public changes require a versioning and migration plan. Internal APIs
may evolve before pilot but still require consumers, schemas, and tests to be
updated atomically. Generated API documentation cannot replace domain and
authorization review.
