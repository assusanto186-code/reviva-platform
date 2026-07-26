# @reviva/conversation

Pure, deterministic conversation and authorization domain for Emma. REV-011B
keeps the aggregate, commands, events, policies, failures, transition engine,
and event replay free from infrastructure and vendor concerns. REV-011C adds a
pure deny-by-default capability evaluator and closed tool registry without
executing tools. REV-011C is Complete; REV-011D is Ready to Start but has not
started.

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
- One canonical capability vocabulary and immutable capability sets.
- `AuthorizationContext`, typed authorization decisions, and
  `authorizeCapability`.
- Immutable provider-agnostic tool descriptors, `createToolRegistry`, and
  `authorizeToolRequest`.
- `requiredCapabilityForCommand`, backed by the same canonical vocabulary.

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

## Authorization and Registry

Effective authority is the intersection of global, subscription, tenant,
location, actor/role, delegation, and conversation-state authority. Every
missing or narrower layer denies; tenant and location policy cannot expand a
broader layer. Booking create/modify requires matching confirmation,
autonomous cancellation requires human approval, handoff blocks autonomous
effects, resume requires a human plus fresh delegation, and reactivation stops
without an approved basis or after opt-out.

The registry accepts only explicit, immutable descriptors with canonical
capabilities, unique ID/version and name/version pairs, actor categories,
confirmation/approval policy, effect classification, and contract references.
Unknown tools, arbitrary fields, provider metadata, and execution functions are
rejected. Registry authorization returns a decision only.

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
The capability, authorization, and registry policy is documented in
`docs/conversation/CAPABILITY_AND_TOOL_POLICY.md`.
