# Conversation State Machine Implementation

Status: REV-011B Complete; REV-011C Ready to Start

Last reviewed: 2026-07-20

## Scope

`@reviva/conversation` implements the accepted REV-011A deterministic domain.
It is in-memory only. It does not implement persistence, capability evaluation,
tool execution, AI providers, application orchestration, delivery, API, or UI.

## Mechanics

`handleConversationCommand` validates duplicate knowledge, timestamps, tenant
and actor consistency, expected version, current state, stale action evidence,
and command invariants. An accepted command constructs exactly one immutable
event. `applyConversationEvent` is the only projection-changing function.

The event sequence and aggregate version both begin at one and advance once per
accepted event. A rejected command emits no event and does not change version.
The caller supplies every ID and timestamp.

## Aggregate Projection

The projection contains tenant/location ownership, channel, participants,
contact, owner, state, booking and reactivation progress, handoff state, pending
tool identity, version/sequence, lifecycle timestamps, closure reason, and safe
failure recovery metadata. Message bodies remain in immutable message events,
not in a mutable aggregate history array.

## Transition Matrix

The table records the principal accepted path and representative denied path
assessed for every top-level state. Full table-driven cases are executable in
`packages/conversation/test/transition-matrix.test.mjs`.

| Current state | Representative accepted command | Result | Representative denied behavior |
| --- | --- | --- | --- |
| `New` | `RecordInboundMessage` | `Active` | Tool proposal fails invalid transition |
| `Active` | `MarkAwaitingUser` | `AwaitingUser` | Booking scheduling without confirmation fails |
| `AwaitingUser` | `RecordInboundMessage` | `Active` | Tool proposal fails invalid transition |
| `AwaitingConfirmation` | `RecordPatientConfirmation` | Confirmation recorded; state retained until scheduling | Wrong digest fails `StaleConfirmation` |
| `AwaitingTool` | `RecordToolSucceeded` | Explicit next state | Wrong tool/effect fails `StaleToolResult` |
| `AwaitingHuman` | `AcceptHumanHandoff` | `HandedOff` | Autonomous AI effect fails `HandoffRequired` |
| `HandedOff` | `ResolveHumanHandoff` | `Active` or `Resolved` | Autonomous AI effect fails `HandoffRequired` |
| `Resolved` | `ReopenConversation` | `Active` | Autonomous tool proposal fails |
| `Closed` | `ReopenConversation` | `Active` | All other appended events fail |
| `Failed` | `RecoverConversation` when recoverable | `Active` | Nonrecoverable recovery fails |

## Booking and Reactivation

Required booking fields use `unknown`, `proposed`, `confirmed`, or
`invalidated`. `RequestConfirmation` requires a complete summary. Create and
modify scheduling require a matching confirmed effect digest. Any material
patch after confirmation invalidates it. `booking.cancel` always returns
`HumanApprovalRequired` for autonomous proposal or scheduling.

Reactivation records campaign and sequence references plus response. Explicit
opt-out cannot be reversed inside the workflow and disables autonomous AI
effects. Conversion initializes booking intent without executing a booking.

## Handoff and Stale Actions

Handoff request moves to `AwaitingHuman` and pauses AI. Acceptance moves to
`HandedOff` with assist-only mode and human ownership. Patient messages remain
recordable without resuming automation. Resume requires a human command and a
delegation issued for the current version. Old AI delegation, confirmation, or
tool identity is rejected through a typed failure.

## Replay Integrity

`rehydrateConversation` rejects an empty stream, missing initial event,
sequence gaps/duplicates, duplicate event IDs, tenant/conversation mismatch,
unsupported versions, impossible order, and post-closure events other than an
explicit reopen. Repeated replay of the same event stream produces an identical
frozen projection.

## Concurrency and Duplication

Every non-start command compares `expectedVersion` with the current projection.
Conflict returns retryable `ConcurrencyConflict`; the domain never replays a
stale command automatically. Persistence may supply a known command outcome or
known inbound message through `CommandHandlingContext`; the domain returns
typed `DuplicateCommand` or `DuplicateInboundMessage` without storing an
unbounded ID list.

## Remaining REV-011C Prerequisites

- Enforce `requiredCapabilityForCommand` before command execution.
- Bind evaluated permission, resource scope, tenant/location narrowing, and
  delegation policy in application orchestration.
- Implement the closed tool registry and effect authorization separately.

No capability enforcement or tool runtime is implemented by REV-011B.

## Audit Safeguard Status

- AUD-006 is closed: web Auth uses one strict Supabase root-origin validator;
  hosted Auth consumes the same unmodified value, and deterministic tests reject
  paths, queries, fragments, credentials, ports, non-Supabase hosts, and
  unapproved local HTTP.
- AUD-009 is closed within the agreed scope for `@reviva/conversation`: exports are explicit, internal
  helpers remain private, runtime vendor imports are absent, and the internal
  import graph has no cycle. Adding `server-only` to the root
  `@reviva/postgres` entry remains unsafe because its legitimate Node integration
  consumers execute outside the React Server export condition; a future split
  server entry is the proposed correction.
- The AUD-005 domain requirement is satisfied, with a precise browser/session
  E2E residual still tracked. Current verification covers route
  protection logic, callback exchange behavior, hosted sign-in/getUser/trusted
  context/logout, and the production Next.js build, but it is not a real browser
  or HTTP session journey through `/login`, `/auth/callback`, `/app`, and logout.
  Closing that final gap requires an approved route/browser harness; REV-011B
  does not add a large browser-testing dependency.
