# ADR-001: Supabase Authentication

Status: Accepted

Date: 2026-07-16

Deciders: Reviva Engineering

Related milestone: REV-009

## Context

Reviva needs authentication for a multi-tenant SaaS application serving med
spa owners, managers, agents, and viewers. Authentication must establish a
verifiable user identity without allowing a browser-provided tenant ID or role
to become authorization evidence.

The first-customer stack already selects Next.js, Vercel, Supabase PostgreSQL,
and Supabase Storage. Using a separate identity platform would add an extra
vendor, identity synchronization, and operational boundary before Reviva has a
validated need for it.

This decision does not make authentication equivalent to authorization.
Tenant membership, role, tenant status, and resource access remain Reviva
business rules and database controls.

## Decision

Reviva will use Supabase Auth for first-customer authentication.

The Next.js application will use Supabase's server-side PKCE flow and cookie
integration. Supabase SDK usage will live in an infrastructure package, not in
`@reviva/domain`. Because `@supabase/ssr` is currently documented as beta, its
version will be pinned and hidden behind Reviva-owned session interfaces so it
can be upgraded or replaced without changing domain logic.

Initial sign-in methods will be verified work email with password or email
one-time link. Social providers remain disabled until a customer requirement,
account-linking policy, and support process are approved.

### Identity boundary

For each protected request, the server will:

1. validate the Supabase session using the current server-side Auth API;
2. read the immutable Auth subject from the validated session;
3. resolve that subject to one active Reviva `User`;
4. resolve the requested tenant against an active Reviva `Membership`;
5. reject suspended tenants, disabled users, and inactive memberships;
6. create a `TenantContext` with the database-derived tenant and role, the
   authenticated user ID, and a server-generated request ID.

A tenant candidate may come from a route, subdomain, or explicit tenant
selector, but it is only a lookup hint. The server must prove the matching
membership before constructing `TenantContext`. Roles and tenant IDs supplied
in request bodies, query strings, headers, user-editable metadata, or browser
storage are never trusted.

Authorization data will remain in Reviva membership tables rather than
Supabase `raw_user_meta_data`. This avoids trusting user-editable claims and
avoids stale role decisions in long-lived access tokens.

### Session policy

- Access-token lifetime starts at Supabase's recommended one-hour default.
- Before pilot, Pro session controls will enforce a 12-hour maximum session and
  a 60-minute inactivity timeout, subject to operator usability testing.
- MFA is mandatory for owners and administrators before pilot access. Other
  roles may enroll voluntarily until a broader policy is approved.
- Sensitive operations such as credential rotation, ownership transfer, and
  data export require a recently validated `aal2` session.
- Sign-out, password reset, membership revocation, and user disablement must be
  covered by authorization tests. High-risk operations also confirm the
  current session and membership instead of relying only on an unexpired JWT.

### Credential protection

- The Supabase publishable key may be used by the browser with RLS and
  least-privilege grants enabled.
- Supabase secret keys, legacy service-role keys, database credentials, and JWT
  signing material are server-only secrets stored in Vercel environment
  variables and the authorized operations vault.
- Secret or service-role credentials must never be included in a
  `NEXT_PUBLIC_*` variable, browser bundle, client component, log, fixture, or
  repository file.
- New opaque publishable/secret keys are preferred over legacy JWT-based
  `anon`/`service_role` keys.
- Secret-key use is isolated to narrowly scoped administrative adapters. The
  production repository adapter will use a restricted PostgreSQL role and will
  not use an RLS-bypassing service role.
- Credential ownership, rotation date, and emergency revocation procedure must
  be recorded before pilot.

### Audit policy

Authentication and authorization audit events will record the Reviva actor ID,
tenant ID when resolved, Supabase Auth subject, session ID where appropriate,
request ID, event type, result, reason code, and timestamp. Tokens, cookies,
passwords, one-time codes, and full request bodies are prohibited from logs and
audit metadata.

Required events include sign-in success/failure, sign-out, MFA enrollment and
challenge, tenant selection, membership denial, role change, user disablement,
credential rotation, and administrative impersonation if that capability is
ever introduced.

## Consequences

### Positive

- Auth and PostgreSQL share one managed platform and identity subject.
- Supabase supports Next.js server-side sessions, PKCE, MFA, and RLS-aware
  access.
- Reviva keeps tenant authorization in its own domain and database model.
- An infrastructure wrapper limits vendor coupling and beta API exposure.

### Costs and risks

- Supabase Auth is an operational dependency and outage domain.
- SSR cookie behavior and the beta `@supabase/ssr` package require pinned
  versions, regression tests, and monitored upgrades.
- JWT claims can be stale until refresh, so membership-sensitive operations
  must consult current database state.
- Account recovery, MFA loss, invitations, and offboarding require operator
  workflows before customers can depend on authentication.

## Alternatives Considered

- **Build authentication internally:** rejected because credential security,
  recovery, MFA, and session revocation are undifferentiated high-risk work.
- **Use a separate hosted identity provider:** deferred because it adds cost and
  synchronization without a demonstrated first-customer requirement.
- **Store tenant roles only in JWT metadata:** rejected because user metadata
  can be editable and all token-carried authorization can become stale.

## Implementation Gate

Authentication implementation may begin only when it:

- introduces an infrastructure boundary rather than importing Supabase into
  `@reviva/domain`;
- proves server-side session validation and membership-derived `TenantContext`;
- tests disabled users, inactive memberships, suspended tenants, cross-tenant
  selection, stale sessions, and MFA enforcement;
- contains fake/demo identities only until the privacy and HIPAA milestones
  authorize real customer data.

## References

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Server-side rendering with Supabase Auth](https://supabase.com/docs/guides/auth/server-side)
- [Supabase Auth sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase multi-factor authentication](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Securing Supabase data and credentials](https://supabase.com/docs/guides/database/secure-data)
