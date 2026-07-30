# REV-011F Tool Runtime and Human Handoff

Status: Complete; accepted by CTO technical review

## Boundary

`@reviva/runtime` is the provider-independent application boundary between the
data-only `ToolProposal` produced by `@reviva/execution` and an approved
application handler. The Execution Engine performs inference orchestration and
proposal validation. It cannot execute a tool. The Tool Runtime does not infer;
it revalidates current trusted facts and coordinates authorized effects.

Dependency direction is one way:

```text
@reviva/runtime
  -> @reviva/execution
  -> @reviva/conversation

@reviva/execution
  -> @reviva/conversation
```

Neither `@reviva/conversation` nor `@reviva/execution` depends on the runtime.
The runtime has no Next.js, Supabase, PostgreSQL, provider SDK, HTTP, browser,
filesystem, or environment dependency.

## Closed Execution Path

1. Reconstruct an immutable `RuntimeExecutionRequest`.
2. Validate tenant, conversation, actor, correlation, state, and version.
3. Resolve the exact tool/version from a closed immutable registry.
4. Revalidate capability intersection, actor category, delegation, handoff,
   confirmation, approval, timeout class, and idempotency scope.
5. Reserve the canonical request fingerprint.
6. Load the current projection in the coordinated transaction and reject stale
   state.
7. Invoke the static handler once with immutable arguments and a scoped view.
8. Apply any domain command through the Conversation state machine.
9. Atomically write applicable event, projection, snapshot, execution record,
   audit, idempotency result, and deferred outbox message.
10. Commit once and return an immutable normalized `ToolResult`.

Unknown tools, foreign registries, schema/capability mismatch, missing
authority, stale state, and malformed canonical values fail closed. Model or
provider output cannot register a handler or create authority.

## Confirmation and Approval

Evidence is immutable and linked to tenant, conversation, actor, effect digest,
conversation version, correlation, recording time, and optional expiry.
Cancellation approval also records an approver. Missing or expired evidence
returns a pending result without invoking the handler. Evidence from another
effect or scope is denied.

The initial handler set is deliberately small:

- `booking.create@1` requires current patient confirmation and writes a
  deferred booking request plus `ToolExecutionScheduled`;
- `booking.cancel@1` is available only to approved staff/human operators,
  requires current human approval, and writes a cancellation request without
  claiming cancellation has occurred.

Both handlers validate exact bounded argument shapes. No real booking or
messaging provider exists in this milestone.

## Transactions, Idempotency, and Outbox

The runtime owns transaction begin, commit, and rollback. Handlers receive no
transaction manager and cannot commit independently. Hidden nesting, reuse,
double completion, cross-tenant access, and stale writes are rejected.

Idempotency is scoped by tenant, actor, operation/tool, key, and canonical
fingerprint. A completed duplicate replays the stored result. A processing
duplicate returns a typed outcome. A different payload under the same scope is
denied. Rollback does not leave a completed reservation.

`DeferredExternal` means the local transaction accepted a pending outbox
command; it does not mean the remote effect was delivered. The payload contains
only validated effect data, scope, tool/version, correlation, causation,
idempotency identity, destination, and bounded delivery policy. It contains no
credentials, arbitrary headers/URLs, executable functions, raw provider
response, or chain-of-thought.

No distributed transaction is claimed. A future worker must deliver messages
idempotently. `SynchronousExternal` is modeled, but uncertain completion enters
`ReconciliationRequired` with `retryBlindly: false`.

## Execution Record and Result

The execution-record state machine is closed:

```text
Proposed -> Validated -> Executing -> Succeeded
                    |             -> Failed
                    |             -> ReconciliationRequired
                    -> AwaitingConfirmation
                    -> AwaitingHumanApproval
Proposed -> Denied
```

Records contain identifiers, scope, actor, capability, proposal digest,
idempotency identity, attempt count, expected version, safe failure code,
handler-result digest, caller-supplied timestamps, and bounded reconciliation
metadata. They never contain credentials or unrestricted raw responses.

`ToolResult` normalizes success, deferred acceptance, pending evidence, denial,
processing duplicates, failure, and reconciliation. It returns safe facts,
produced identifiers, projection version, attempt count, requirements, and a
provider-independent continuation directive. It performs no inference.

## Human Handoff

The handoff lifecycle is closed and optimistic:

```text
NotRequested -> Requested -> Queued -> Assigned -> Accepted -> Resolved
                                                          -> ReturnedToAutomation
Requested/Queued/Assigned -> Cancelled
```

Transitions are tenant- and conversation-scoped, actor- and role-checked,
correlated, caller-timestamped, versioned, and recorded in immutable history.
Duplicate transition IDs replay without another mutation.

Handoff request and acceptance update the Conversation projection to
`AwaitingHuman` and `HandedOff`, so autonomous tool execution is denied by the
canonical authorization boundary. A resolved handoff remains restricted until
a human supplies fresh current-version delegation for explicit return to
automation. This milestone has no operator dashboard or production queue.

## Composition and Reference Limits

`createRuntimeComposition` assembles the registry, runtime, handoff service, and
supplied persistence without a global service locator. Pure packages do not
read configuration or credentials.

Modules under `packages/runtime/src/reference/` are deterministic,
single-process, in-memory, non-durable, non-networked, and not production-safe.
There is no production database adapter, outbox worker, broker, provider
gateway, booking integration, endpoint, streaming UI, or operator interface.

## AUD-005

AUD-005 remains open. The repository has no installed and configured real
browser automation harness that can drive the Next.js callback,
server-side cookie/session lifecycle, protected route, server action, logout,
and post-logout rejection as a browser/HTTP journey. Hosted Supabase Auth
integration is service-boundary evidence, not browser E2E. Closing AUD-005
requires a separately approved harness and honest real browser/HTTP evidence.
