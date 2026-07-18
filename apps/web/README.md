# Reviva Web

`apps/web` is the Next.js delivery application for Reviva. It contains the
public landing and lead-capture experience, Supabase SSR authentication
adapters, and the protected application shell.

## Workspace Relationship

The application is part of the root pnpm/Turborepo workspace and composes:

- `@reviva/auth` for session and trusted tenant-context rules;
- `@reviva/postgres` for restricted PostgreSQL identity and tenant access;
- Next.js-specific Supabase SSR adapters kept inside `apps/web`.

Core domain and persistence rules belong in their internal packages, not in
React components or route handlers. Run dependency installation from the
repository root and use pnpm only.

## Commands

From the repository root:

```text
pnpm dev
pnpm --filter web lint
pnpm --filter web build
pnpm --filter web test
pnpm auth:test:integration
```

The hosted Auth integration command requires the ignored Development
environment described in `docs/AUTHENTICATION.md`. Never print or commit local
environment values.

## Authentication Summary

Supabase owns credentials and cookie sessions. Protected server operations call
the live Auth user-validation endpoint, resolve the current Reviva user and
active membership through restricted PostgreSQL access, create a trusted
`TenantContext`, and execute through forced RLS. Browser-provided tenant IDs or
roles are never authoritative.

The Next.js Proxy refreshes session cookies optimistically; authorization still
occurs in the server-only data-access layer. Current hosted verification covers
Supabase authentication, identity and membership resolution, trusted context,
restricted database access, logout, and local session invalidation. It is not a
browser end-to-end test.

## Documentation

- Milestone status: `docs/PROJECT_STATUS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Authentication setup: `docs/AUTHENTICATION.md`
- Vercel deployment: `docs/VERCEL_PRODUCTION_DEPLOYMENT.md`
