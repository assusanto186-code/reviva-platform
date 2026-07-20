# @reviva/conversation

Pure, deterministic conversation domain for Emma. REV-011B keeps the aggregate,
commands, events, policies, failures, transition engine, and event replay free
from infrastructure and vendor concerns.

## Boundary

The only workspace dependency is `@reviva/domain`, used through type-only
imports for the stable `TenantId` and `LocationId` primitives. The emitted
JavaScript has no runtime import from it. This preserves tenant-type
interoperability without coupling conversation behavior to Auth, PostgreSQL,
Supabase, Next.js, React, HTTP, browser APIs, providers, or booking systems.

The package never generates IDs, reads a clock, performs I/O, or stores state.
Callers supply identifiers, timestamps, actor context, correlation/causation,
expected version, and duplicate knowledge.

## Processing Contract

```text
typed command + current projection + duplicate contract
  -> deterministic validation
  -> immutable event
  -> applyConversationEvent
  -> immutable next projection or typed failure
```

Projection mutation outside event application is unsupported. Model output is
not a command and is not represented by this package.

## Public API

- Identifier constructors and opaque identifier types.
- `Conversation`, state, actor, participant, booking, reactivation, and handoff
  models.
- `ConversationCommand` and individual typed commands.
- `ConversationEvent` and individual immutable events.
- `handleConversationCommand` for deterministic command decisions.
- `applyConversationEvent` for one ordered event.
- `rehydrateConversation` for deterministic replay.
- Typed `ConversationResult` and `ConversationFailure` contracts.
- Pure booking, handoff, reopen, and AI-effect eligibility policies.
- `requiredCapabilityForCommand`, which declares future authorization needs but
  does not perform REV-011C capability enforcement.

Internal freezing helpers and event construction helpers are intentionally not
exported.

## Enforced Business Rules

- Every mutation requires exact `expectedVersion`.
- Booking creation and material modification require matching explicit patient
  confirmation.
- A material booking change invalidates prior confirmation.
- Autonomous appointment cancellation fails with `HumanApprovalRequired`.
- Handoff pauses autonomous effects; accepted handoff is assist-only.
- Automation resumes only through an explicit human command carrying a fresh
  delegation reference.
- Stale AI, confirmation, and tool-result commands fail safely.
- Reactivation opt-out is irreversible in the active workflow.
- Events, messages, results, and projections are immutable.

## Commands

The command vocabulary covers conversation start/messages/waiting, booking
intent and confirmation, tool lifecycle facts, handoff and ownership,
reactivation response, resolution/closure/reopen, and failure/recovery.

Tool commands represent already validated application intent. They do not call
or authorize a tool.

## Tests

```powershell
pnpm --filter @reviva/conversation lint
pnpm --filter @reviva/conversation build
pnpm --filter @reviva/conversation test
```

Tests use explicit in-memory fixtures only. They require no network, database,
provider, filesystem reads, real clock, or random ID generation.

The assessed state/command matrix is documented in
`docs/conversation/STATE_MACHINE_IMPLEMENTATION.md`.
