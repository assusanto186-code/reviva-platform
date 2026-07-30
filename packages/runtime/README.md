# `@reviva/runtime`

`@reviva/runtime` is Reviva's provider-independent application boundary for
authorized tool execution and controlled human handoff. It connects validated
`ToolProposal` values to closed, reviewed handlers without giving model output
authority.

## Guarantees

- Every request is reconstructed from trusted, immutable application facts.
- Tool identity, schema, actor, capability, delegation, confirmation, approval,
  conversation state, tenant scope, and version are revalidated.
- One runtime invocation owns one coordinated transaction.
- Idempotency is tenant-, actor-, operation-, and payload-scoped.
- Local events, projections, optional snapshots, audit, execution records,
  idempotency state, and deferred outbox work commit together.
- Unknown tools and handlers fail closed.
- Uncertain external effects require reconciliation and are never retried
  blindly.
- Handoff transitions are closed, optimistic, role-aware, and preserve an
  immutable history.

The package does not read environment variables, call AI providers, perform
network I/O, discover tools dynamically, run arbitrary code, or implement an
outbox worker.

## Effect model

`LocalTransactional` effects remain inside the application transaction.
`DeferredExternal` effects write a pending outbox message in that transaction;
delivery has not occurred when the runtime returns
`ExternalEffectDeferred`. `SynchronousExternal` is modeled explicitly but is
not used by the initial release handlers because a local database transaction
cannot make a remote call atomic.

## Reference-only modules

Modules below `dist/reference/` provide deterministic, single-process,
non-durable test implementations. They do no network or filesystem I/O and are
not production-safe. They are deliberately absent from the package's primary
public API.

## Commands

```bash
pnpm --filter @reviva/runtime lint
pnpm --filter @reviva/runtime build
pnpm --filter @reviva/runtime test
```
