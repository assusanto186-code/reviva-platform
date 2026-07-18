# Reviva Authentication Setup

Status: REV-010 Complete

Last reviewed: 2026-07-18

## Implemented Flow

```text
Supabase Auth cookie session
-> Next.js Proxy cookie refresh
-> server-side getUser validation
-> auth_subject lookup through reviva_app
-> active Reviva user and membership validation
-> server-generated TenantContext
-> transaction-local PostgreSQL context and forced RLS
-> protected /app shell
```

Supabase owns credentials and sessions only. Reviva owns business users,
memberships, tenant status, roles, and authorization. A tenant or role supplied
by the browser is never authoritative.

## Environment

Copy `apps/web/.env.example` to the ignored `apps/web/.env.local`. Set:

- browser-safe `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Development project;
- server-only `REVIVA_DB_RUNTIME_URL` for the restricted `reviva_app` role;
- Development test guards and fake-user credentials only when running the
  hosted integration test.

Never put a secret/service-role key, database URL, test password, token, or
cookie in a `NEXT_PUBLIC_*` variable, Git, terminal output, or support chat.
Production/Preview values belong in the host secret manager.

## Safe Development User Provisioning

1. In the linked Supabase **Development** project, leave the email/password
   provider enabled and create a fake user under Authentication > Users. Use no
   real customer, patient, or employee identity.
2. Copy the new Auth user UUID locally. Do not send the password or UUID in
   chat.
3. As the Development database administrator, insert a fake tenant, Reviva
   user, and one active membership. Set `users.auth_subject` to that Auth UUID.
   Use unique fake UUIDs and an `@example.test` address. Do not change schema in
   the dashboard; schema changes remain migration-only.
4. Put the fake sign-in email/password in ignored `apps/web/.env.local` as
   `REVIVA_AUTH_TEST_EMAIL` and `REVIVA_AUTH_TEST_PASSWORD`. Put the public
   project URL/key there as well. Reuse the restricted runtime URL and test
   guard values from the ignored Development database environment.
5. Load both ignored environment files into the current process without
   echoing values, build `@reviva/auth` and `@reviva/postgres`, then run:

   ```text
   pnpm auth:test:integration
   ```

6. Confirm the test signs in, calls the live Auth user-validation endpoint,
   resolves the mapped Reviva identity through `reviva_app`, executes a
   tenant-scoped RLS query, signs out, and reports one pass.
7. Delete the fake Auth user and corresponding fake database rows when the
   fixture is retired.

## Route Behavior

- `/login` uses a Server Action and returns one generic credential error.
- `/auth/callback` exchanges a PKCE code and permits redirects only beneath
  `/app`.
- `/app` redirects missing/invalid/expired sessions to `/login`; valid Auth
  users without an active Reviva mapping receive a controlled state.
- Logout clears the local Supabase session and returns to `/login`.

The Proxy is not an authorization boundary. Each protected server operation
must obtain a fresh trusted context and pass it to the transaction coordinator.

## Deferred Features

Password reset, invitation flows, tenant selector UI, MFA enforcement, AAL2
step-up, global sign-out, audit events, account recovery, and production session
limits are deferred. Owners/admins must not enter a pilot before MFA and the
session controls in ADR-001 are implemented and tested.

## Completion Evidence

REV-010 hosted verification completed on 2026-07-18 using a fake Development
Auth user and fake tenant data only. The unmodified project-root URL completed
password sign-in, server-side `getUser` validation, Reviva identity and active
membership resolution, trusted `TenantContext` creation, a restricted
`reviva_app` transaction, logout, and post-logout session rejection.

The final gate passed root and web lint/build/tests, strict TypeScript, 16
hosted PostgreSQL tests, the hosted Auth integration test, linked database
lint, migration synchronization, whitespace and marker scans, exact-value and
pattern secret scans, client-bundle exposure checks, and generated-artifact
checks. Runtime direct access to `users` remained denied and no local
environment file, credential, Auth identity, or temporary verification file
was tracked.
