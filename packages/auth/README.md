# @reviva/auth

Vendor-independent authentication and trusted tenant-context application
boundary.

The package accepts only a provider identity that has already been verified by
a server-side adapter. It resolves the current Reviva user and membership from
persistence, rejects inactive or ambiguous access, and produces the existing
`TenantContext`. Tenant IDs and roles supplied by a browser are never accepted
as authority.

Supabase SDKs intentionally do not belong in this package or in
`@reviva/domain`.

```text
pnpm --filter @reviva/auth lint
pnpm --filter @reviva/auth test
```
