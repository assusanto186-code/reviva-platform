# Conversation State Machine Specification

Status: REV-011A Complete — accepted architecture specification

## Rule of Authority

The state machine is a pure deterministic component. A model MAY propose an
intent or command candidate but MUST NOT set state. The application validates
the proposal, supplies trusted facts and capabilities, and dispatches a typed
command with an expected aggregate version.

## Top-level States

| State | Meaning | Allowed owner |
| --- | --- | --- |
| `New` | Conversation exists but first inbound command is not accepted | System/unassigned |
| `Active` | Emma or a human may process the current turn | AI or human |
| `AwaitingUser` | A safe response requested missing input | AI |
| `AwaitingTool` | A validated tool execution is scheduled/in flight | AI/system |
| `AwaitingConfirmation` | A specific proposed effect awaits patient confirmation | AI |
| `AwaitingHuman` | Handoff is queued; AI behavior is restricted | Human queue |
| `HandedOff` | Human accepted ownership | Human |
| `Resolved` | Objective completed; conversation may reopen by policy | System/human |
| `Closed` | Terminal administrative closure | System/human |
| `Failed` | Invariant or exhausted recovery made automated processing unsafe | System/human |

Orthogonal data tracks booking/reactivation intent, delivery state, and handoff
details. These MUST NOT be encoded as uncontrolled combinations of top-level
states. `Resolved`, `Closed`, and `Failed` are terminal for the current lifecycle;
reopening creates an explicit event and, where policy permits, a new lifecycle
version rather than silently changing history.

## Commands and Outcomes

| Command | Principal | Primary outcome |
| --- | --- | --- |
| `AcceptInboundMessage` | Patient/channel integration | Append message; activate or update intent |
| `RecordAssistantProposal` | System process | Persist validated model proposal evidence |
| `SendAssistantMessage` | Delegated AI/human | Append outbound message and delivery intent |
| `RequestInformation` | Delegated AI/human | `AwaitingUser` |
| `ProposeToolAction` | AI suggestion via application | Persist proposal; no effect yet |
| `RequestConfirmation` | Application | `AwaitingConfirmation` with immutable effect digest |
| `ConfirmAction` | Patient/contact principal | Authorize only the matching, unexpired digest |
| `ScheduleToolExecution` | System with capability | `AwaitingTool` plus outbox intent |
| `RecordToolResult` | Tool worker | Next deterministic state based on result |
| `RequestHandoff` | Patient, AI recommendation, staff, or policy | `AwaitingHuman` |
| `AcceptHandoff` | Authorized human | `HandedOff` and transfer ownership |
| `ResolveHandoff` | Assigned human | `Active` or `Resolved` by explicit outcome |
| `ResolveConversation` | Authorized actor/system policy | `Resolved` |
| `CloseConversation` | Authorized human/system policy | `Closed` with reason |
| `RecordFailure` | System | Retry, handoff, or `Failed` by taxonomy |

Every accepted command returns the new version, emitted immutable events,
outbox intents, user-visible response intent when applicable, and audit decision.
Invalid commands return typed failures and emit no state mutation.

## Transition Table

| From | Command/event | Guard | To |
| --- | --- | --- | --- |
| `New` | Valid inbound accepted | Tenant/channel/contact scope valid | `Active` |
| `Active` | Missing required information | Safe question exists | `AwaitingUser` |
| `Active` | Valid read-only tool | Capability and tool policy allow | `AwaitingTool` |
| `Active` | Mutation needs consent | Effect digest complete | `AwaitingConfirmation` |
| Any nonterminal | Handoff required | Policy or actor requests | `AwaitingHuman` |
| `AwaitingUser` | Nonduplicate inbound | Correlates to conversation | `Active` |
| `AwaitingConfirmation` | Matching confirmation | Unexpired digest and version match | `AwaitingTool` |
| `AwaitingConfirmation` | Rejection/expiry | Proposal still current | `Active` or `Resolved` |
| `AwaitingTool` | Successful result | Result correlation/version valid | `Active`, `AwaitingUser`, or `Resolved` |
| `AwaitingTool` | Recoverable failure | Retry budget available | `AwaitingTool` |
| `AwaitingTool` | Unsafe/exhausted failure | Handoff policy applies | `AwaitingHuman` |
| `AwaitingHuman` | Authorized acceptance | Queue/tenant/location match | `HandedOff` |
| `HandedOff` | Human resolution | Assignee and capability valid | `Active` or `Resolved` |
| `Resolved` | Reopen request | Reopen policy and capability allow | `Active` |
| Any nonterminal | Administrative close | Capability and reason present | `Closed` |
| Any nonterminal | Internal invariant failure | Recovery unsafe | `Failed` |

## Guards

Transition guards MUST evaluate trusted aggregate state, expected version,
principal binding, capabilities, tool policy, location scope, confirmation or
approval evidence, budget, idempotency, and correlation. Model confidence MAY
inform clarification or handoff but MUST NOT bypass a guard.

## Timeout and Retry

- Awaiting-user and confirmation expiry append timeout events; they do not
  rewrite the original request.
- Retryable provider failures occur outside aggregate transactions and permit
  at most two retries after the initial request. Authorization, state,
  confirmation, policy, and non-retryable failures MUST NOT be retried.
- Tool retries reuse the same idempotency key and effect digest.
- An optimistic conflict reloads current state and re-evaluates the original
  command; it MUST NOT blindly replay stale output.
- Exhausted retry, expired confirmation, or stale result follows explicit
  handoff/failure policy.

The two-retry provider limit is accepted architecture policy. Retry backoff and
timeout durations remain pending implementation configuration and MUST be
versioned policy, not constants hidden in adapters.

## Required Examples

| Scenario | Deterministic sequence |
| --- | --- |
| Informational question | `AcceptInboundMessage` → retrieve published evidence → validate assistant proposal → append cited response → `AwaitingUser` |
| Booking request | Accept inbound → classify intent → collect fields → select availability → present complete summary → receive explicit patient confirmation → schedule idempotent booking tool |
| Insufficient booking information | Accept inbound → store missing-field set → `RequestInformation` → `AwaitingUser` |
| Appointment modification | Collect material changes → invalidate prior confirmation → present updated summary → receive fresh explicit confirmation → schedule modification |
| Appointment cancellation | Explain policy and collect reason → request human approval/handoff; autonomous cancellation is PROHIBITED |
| Tool approval required | Proposal → capability passes → human approval request event → `AwaitingHuman`; no outbox tool intent yet |
| External booking failure | Correlated failure → bounded retry if safe → clarification/handoff; never claim success |
| Human handoff | Request event → `AwaitingHuman` → authorized acceptance → `HandedOff`; AI output becomes assist-only or suppressed |
| User abandonment | Awaiting state expires → timeout event → configured `Resolved`/handoff outcome, not fabricated completion |
| Reactivation response | Deduplicate inbound → establish contact/consent policy → `Active`; campaign context is untrusted metadata |
| Duplicate inbound | Existing channel message ID/idempotency claim returns prior outcome; version and history unchanged |
| Concurrent agent/user activity | First expected-version command commits; stale command conflicts, reloads, and is discarded or re-evaluated |

## Invalid Transitions

Invalid transitions return `InvalidStateTransition` with safe state/command
codes and correlation ID. They MUST be auditable when security- or
side-effect-relevant, MUST NOT expose message content or internal policy, and
MUST NOT increment aggregate version.

## Replay and Debugging

Replay orders events by aggregate sequence, then stable event ID. Event time is
evidence but not ordering authority because channel and provider clocks may
skew. A projection checksum and version SHOULD be compared during replay.
Hidden chain-of-thought MUST NOT be stored or required for reconstruction.

## Non-goals

This specification does not implement the reducer, choose timeout/backoff
values, define database tables, or allow a model/provider-native tool call to
become a command.
