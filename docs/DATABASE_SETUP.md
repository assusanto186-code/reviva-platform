# Reviva Database Environment Setup

Status: Hosted Development Verified; Local Docker Recovery Pending

Last reviewed: 2026-07-17

## Required Tools

- Node.js 22 or later;
- pnpm 11.10.0;
- repository-pinned Supabase CLI 2.109.1;
- Docker Desktop with a healthy Linux engine for local Supabase, or a dedicated
  hosted Supabase Development project.

Do not use a Production project for migration experiments, resets, or
integration tests. Use fake data only.

## Local Workflow

Local Supabase remains blocked until the Docker issues recorded in
`DOCKER_RECOVERY.md` are resolved.

When Docker is healthy:

1. Run `pnpm supabase:status`.
2. Start the stack with `pnpm exec supabase start`.
3. Run `pnpm db:reset` to recreate the local database from migrations.
4. Run `pnpm db:lint`.
5. Copy `supabase/.env.example` to ignored `supabase/.env.local` and replace
   every placeholder locally.
6. Load the ignored variables into the terminal without printing them.
7. Run `pnpm db:test`.
8. Stop the stack with `pnpm exec supabase stop` when finished.

The local stack must bind only to the local machine and must not contain real
customer or patient data.

## Hosted Development Workflow

If Docker remains unavailable, create a dedicated Supabase Development project:

1. Name and label the project as Development, not Production.
2. Select the intended first-customer region and PostgreSQL major version 17.
3. Store the project ref, direct administration URL, and transaction-pooler
   runtime URL only in ignored `supabase/.env.local`.
4. Link the CLI to the Development project without committing CLI tokens.
5. Review migration status and dry-run the push before applying migrations.
6. Apply only the ordered files in `supabase/migrations`.
7. Provision a random password for `reviva_app` through an authorized local
   administrative session. Password provisioning is an operational credential
   action, not a source-controlled schema change.
8. Confirm the runtime URL authenticates as `reviva_app` through the transaction
   pooler with TLS.
9. Load the safeguards and run `pnpm db:test`.

Never use `db reset --linked` against a hosted project. Never paste database
URLs, passwords, access tokens, secret keys, or service-role keys into chat.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `REVIVA_DB_ADMIN_URL` | Direct Development connection for migration administration and fixture setup |
| `REVIVA_DB_RUNTIME_URL` | Restricted `reviva_app` connection through the transaction pooler |
| `REVIVA_DB_ENVIRONMENT` | Must equal `development` for integration tests |
| `REVIVA_DB_TEST_PROJECT_REF` | Explicit Development target identity |
| `REVIVA_DB_PRODUCTION_PROJECT_REF` | Production identity used to prevent accidental equality, when one exists |
| `REVIVA_DB_ALLOW_DESTRUCTIVE_TESTS` | Must equal the documented Development-only confirmation |

## Commands

```text
pnpm supabase:status
pnpm db:reset
pnpm db:lint
pnpm db:test
```

`db:reset` and `db:lint` target the local stack. Hosted migrations use reviewed
Supabase CLI link/status/push commands against the explicit Development project.

Hosted verification commands used on 2026-07-17:

```text
pnpm exec supabase migration list --linked
pnpm exec supabase db lint --linked --level error
pnpm db:test
```

The hosted test command passed 13 integration tests three times. Credentials were
loaded from ignored `supabase/.env.local`; no credential values were printed.

## Current Blockers

- Docker Desktop Linux engine is unavailable.
- Local `db:reset` and local `db:lint` remain unavailable until Docker recovers.

Hosted Supabase Development is linked and verified. Development accepts fake
data only: no PHI, real patient records, or production-like conversations.
