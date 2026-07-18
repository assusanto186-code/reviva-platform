# @reviva/postgres

Production PostgreSQL persistence for the existing `@reviva/domain` repository
contracts.

The package uses Postgres.js with prepared statements disabled for Supavisor
transaction mode. `PostgresTransactionCoordinator` establishes validated,
transaction-local tenant context and supplies repository instances bound to the
same connection. Those instances become unusable after commit or rollback.
`PostgresAuthIdentityRepository` uses a narrowly granted resolver function to
map a verified provider subject to minimum user and membership fields while the
runtime role retains no direct `users` access.

## Verification

```text
pnpm --filter @reviva/postgres lint
pnpm --filter @reviva/postgres test
pnpm db:test
```

The integration command requires the fail-closed Development variables listed
in `supabase/.env.example`. Store values only in ignored
`supabase/.env.local`. Use fake data only; never run the suite against
Production or with PHI.

Cache, embedding, and external-search adapters are outside REV-009 and require
their own tenant-key and isolation tests before implementation.
