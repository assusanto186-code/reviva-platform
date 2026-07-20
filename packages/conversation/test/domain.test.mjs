import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidConversationIdentifier,
  conversationId,
  handleConversationCommand,
} from "../dist/index.js";
import { createFixture } from "./fixtures.mjs";

test("identifiers reject blank and control-bearing values deterministically", () => {
  assert.throws(() => conversationId("  "), InvalidConversationIdentifier);
  assert.throws(() => conversationId("bad\u0000id"), InvalidConversationIdentifier);
  assert.equal(conversationId(" conversation-a "), "conversation-a");
});

test("starting a conversation creates immutable New projection and event", () => {
  const f = createFixture();
  const command = f.command("StartConversation", null, {
    tenantId: f.tenant,
    locationId: f.location,
    channel: "web",
    participants: [{ id: "participant-a", kind: "Patient", actorReference: "patient-a", joinedAt: "2026-07-20T00:00:00.000Z" }],
    contactId: f.contact,
    initialOwner: { kind: "ai", actorReference: "emma" },
  });
  const result = handleConversationCommand(null, command);
  assert.equal(result.ok, true);
  assert.equal(result.value.conversation.status, "New");
  assert.equal(result.value.conversation.version, 1);
  assert.equal(result.value.events[0].type, "ConversationStarted");
  assert.equal(Object.isFrozen(result.value.conversation), true);
  assert.equal(Object.isFrozen(result.value.events[0]), true);
});

test("repeated execution with identical explicit inputs is deterministic", () => {
  const a = createFixture();
  const b = createFixture();
  const currentA = a.start();
  const currentB = b.start();
  assert.deepEqual(currentA, currentB);
});

test("normal informational flow activates, records output, and awaits user", () => {
  const f = createFixture();
  let current = f.activate();
  assert.equal(current.status, "Active");
  current = f.expectSuccess(f.run(current, "RecordOutboundMessage", {
    messageId: f.ids.messageId(f.next("message")),
    author: f.actor("AiAgent", current.version),
    content: "How may I help?",
    externalMessageReference: null,
    sentAt: "2026-07-20T00:05:00.000Z",
    deliveryIntentReference: null,
  }, { kind: "AiAgent", delegationVersion: current.version })).conversation;
  current = f.expectSuccess(f.run(current, "MarkAwaitingUser", { reason: "response_sent" })).conversation;
  assert.equal(current.status, "AwaitingUser");
});

test("missing booking information prevents confirmation", () => {
  const f = createFixture();
  let current = f.activate();
  current = f.expectSuccess(f.run(current, "RecordBookingIntent", { operation: "create" })).conversation;
  const result = f.run(current, "RequestConfirmation", {
    effectDigest: "effect-a",
    summaryReference: "summary-a",
  }, { kind: "AiAgent", delegationVersion: current.version });
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "InvalidCommand");
  assert.equal(result.failure.context.reason, "booking_summary_incomplete");
});

test("booking creation cannot schedule before explicit patient confirmation", () => {
  const f = createFixture();
  const current = f.bookingReady("create");
  const result = f.run(current, "RecordToolScheduled", {
    toolIntentId: f.ids.toolIntentId("tool-a"),
    action: "booking.create",
    effectDigest: "effect-a",
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "ConfirmationRequired");
});

test("patient confirmation authorizes only the matching booking digest", () => {
  const f = createFixture();
  const current = f.confirmedBooking("create", "effect-a");
  assert.equal(current.status, "AwaitingConfirmation");
  assert.equal(current.booking.confirmation.status, "confirmed");
  assert.equal(current.booking.confirmation.effectDigest, "effect-a");
  const stale = f.run(current, "RecordToolScheduled", {
    toolIntentId: f.ids.toolIntentId("tool-stale"),
    action: "booking.create",
    effectDigest: "effect-other",
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.failure.code, "ConfirmationRequired");
});

test("material booking change invalidates prior confirmation", () => {
  const f = createFixture();
  let current = f.confirmedBooking("create");
  current = f.expectSuccess(f.run(current, "UpdateBookingProgress", {
    patch: { slot: { status: "proposed", value: "slot-b" } },
  })).conversation;
  assert.equal(current.status, "Active");
  assert.equal(current.booking.confirmation.status, "invalidated");
});

test("appointment modification requires fresh confirmation after a material change", () => {
  const f = createFixture();
  let current = f.confirmedBooking("modify", "modify-a");
  current = f.expectSuccess(f.run(current, "UpdateBookingProgress", {
    patch: { practitioner: { status: "proposed", value: "practitioner-b" } },
  })).conversation;
  const scheduled = f.run(current, "RecordToolScheduled", {
    toolIntentId: f.ids.toolIntentId("tool-modify"),
    action: "booking.modify",
    effectDigest: "modify-a",
  });
  assert.equal(scheduled.ok, false);
  assert.equal(scheduled.failure.code, "ConfirmationRequired");
});

test("autonomous appointment cancellation requires human approval", () => {
  const f = createFixture();
  const current = f.bookingReady("cancel");
  const proposal = f.run(current, "ProposeToolAction", {
    toolIntentId: f.ids.toolIntentId("cancel-a"),
    action: "booking.cancel",
    effectDigest: "cancel-effect",
  }, { kind: "AiAgent", delegationVersion: current.version });
  assert.equal(proposal.ok, false);
  assert.equal(proposal.failure.code, "HumanApprovalRequired");
});

test("tool proposal, scheduling, and success follow explicit waiting states", () => {
  const f = createFixture();
  let current = f.confirmedBooking("create", "effect-a");
  current = f.expectSuccess(f.run(current, "RecordToolScheduled", {
    toolIntentId: f.ids.toolIntentId("tool-a"),
    action: "booking.create",
    effectDigest: "effect-a",
  })).conversation;
  assert.equal(current.status, "AwaitingTool");
  current = f.expectSuccess(f.run(current, "RecordToolSucceeded", {
    toolIntentId: f.ids.toolIntentId("tool-a"),
    effectDigest: "effect-a",
    outcomeReference: "booking-a",
    nextStatus: "Resolved",
  })).conversation;
  assert.equal(current.status, "Resolved");
});

test("read-only tool may schedule from Active and rejects mismatched results", () => {
  const f = createFixture();
  let current = f.activate();
  current = f.expectSuccess(f.run(current, "RecordToolScheduled", {
    toolIntentId: f.ids.toolIntentId("availability-a"),
    action: "booking.availability.read",
    effectDigest: "availability-effect",
  })).conversation;
  assert.equal(current.status, "AwaitingTool");
  assert.equal(current.pendingTool.action, "booking.availability.read");
  const stale = f.run(current, "RecordToolSucceeded", {
    toolIntentId: f.ids.toolIntentId("availability-other"),
    effectDigest: "availability-effect",
    outcomeReference: "availability-result",
    nextStatus: "Active",
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.failure.code, "StaleToolResult");
});

test("recoverable and terminal tool failures have distinct outcomes", () => {
  const recoverableFixture = createFixture();
  let recoverable = recoverableFixture.confirmedBooking();
  recoverable = recoverableFixture.expectSuccess(recoverableFixture.run(recoverable, "RecordToolScheduled", {
    toolIntentId: recoverableFixture.ids.toolIntentId("tool-a"), action: "booking.create", effectDigest: "effect-a",
  })).conversation;
  recoverable = recoverableFixture.expectSuccess(recoverableFixture.run(recoverable, "RecordToolFailed", {
    toolIntentId: recoverableFixture.ids.toolIntentId("tool-a"), effectDigest: "effect-a", reasonCode: "temporary", recoverable: true,
  })).conversation;
  assert.equal(recoverable.status, "Active");

  const terminalFixture = createFixture();
  let terminal = terminalFixture.confirmedBooking();
  terminal = terminalFixture.expectSuccess(terminalFixture.run(terminal, "RecordToolScheduled", {
    toolIntentId: terminalFixture.ids.toolIntentId("tool-a"), action: "booking.create", effectDigest: "effect-a",
  })).conversation;
  terminal = terminalFixture.expectSuccess(terminalFixture.run(terminal, "RecordToolFailed", {
    toolIntentId: terminalFixture.ids.toolIntentId("tool-a"), effectDigest: "effect-a", reasonCode: "unsafe", recoverable: false,
  })).conversation;
  assert.equal(terminal.status, "Failed");
});

test("human handoff pauses AI effects but keeps patient messages recordable", () => {
  const f = createFixture();
  let current = f.activate();
  current = f.expectSuccess(f.run(current, "RequestHumanHandoff", {
    handoffId: f.ids.handoffId("handoff-a"),
    reason: "patient_requested",
    urgency: "High",
    targetQueueReference: "front-desk",
    responseDeadline: "2026-07-20T01:00:00.000Z",
  })).conversation;
  assert.equal(current.status, "AwaitingHuman");
  assert.equal(current.handoff.aiOperatingMode, "paused");

  const ai = f.run(current, "RecordOutboundMessage", {
    messageId: f.ids.messageId("message-ai"), author: f.actor("AiAgent", current.version), content: "Automated", externalMessageReference: null,
    sentAt: "2026-07-20T00:20:00.000Z", deliveryIntentReference: null,
  }, { kind: "AiAgent", delegationVersion: current.version });
  assert.equal(ai.ok, false);
  assert.equal(ai.failure.code, "HandoffRequired");

  current = f.expectSuccess(f.run(current, "RecordInboundMessage", {
    messageId: f.ids.messageId("message-patient"), author: f.actor("Patient"), content: "Still here", externalMessageReference: "external-patient",
    receivedAt: "2026-07-20T00:21:00.000Z",
  }, { kind: "Patient" })).conversation;
  assert.equal(current.status, "AwaitingHuman");
});

test("accepted handoff is assist-only and resume requires explicit fresh delegation", () => {
  const f = createFixture();
  let current = f.activate();
  current = f.expectSuccess(f.run(current, "RequestHumanHandoff", {
    handoffId: f.ids.handoffId("handoff-a"), reason: "complex", urgency: "Normal", targetQueueReference: "queue-a", responseDeadline: null,
  })).conversation;
  current = f.expectSuccess(f.run(current, "AcceptHumanHandoff", {
    handoffId: f.ids.handoffId("handoff-a"), assigneeReference: "operator-a",
  }, { kind: "HumanOperator" })).conversation;
  assert.equal(current.status, "HandedOff");
  assert.equal(current.handoff.aiOperatingMode, "assist_only");

  const stale = f.run(current, "ResumeAutomation", {
    freshDelegationReference: { id: "delegation-stale", issuedForConversationVersion: current.version - 1 },
    aiActorReference: "emma",
  }, { kind: "HumanOperator" });
  assert.equal(stale.ok, false);
  assert.equal(stale.failure.code, "StaleAiAction");

  current = f.expectSuccess(f.run(current, "ResumeAutomation", {
    freshDelegationReference: { id: "delegation-fresh", issuedForConversationVersion: current.version },
    aiActorReference: "emma",
  }, { kind: "HumanOperator" })).conversation;
  assert.equal(current.status, "Active");
  assert.equal(current.currentOwner.kind, "ai");
});

test("stale AI action after ownership change is rejected", () => {
  const f = createFixture();
  let current = f.activate();
  const oldVersion = current.version;
  current = f.expectSuccess(f.run(current, "AssignConversation", {
    owner: { kind: "human", actorReference: "operator-a" },
  })).conversation;
  const stale = f.run(current, "RecordOutboundMessage", {
    messageId: f.ids.messageId("message-stale"), author: f.actor("AiAgent", oldVersion), content: "Late", externalMessageReference: null,
    sentAt: "2026-07-20T00:30:00.000Z", deliveryIntentReference: null,
  }, { kind: "AiAgent", delegationVersion: oldVersion });
  assert.equal(stale.ok, false);
  assert.equal(stale.failure.code, "StaleAiAction");
});

test("resolution, closure, terminal protection, and explicit reopen are deterministic", () => {
  const f = createFixture();
  let current = f.activate();
  current = f.expectSuccess(f.run(current, "ResolveConversation", { reason: "completed" })).conversation;
  assert.equal(current.status, "Resolved");
  current = f.expectSuccess(f.run(current, "CloseConversation", { reason: "archived" })).conversation;
  assert.equal(current.status, "Closed");
  const invalid = f.run(current, "RecordInboundMessage", {
    messageId: f.ids.messageId("late-message"), author: f.actor("Patient"), content: "late", externalMessageReference: "late", receivedAt: "2026-07-20T00:40:00.000Z",
  }, { kind: "Patient" });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.failure.code, "InvalidStateTransition");
  current = f.expectSuccess(f.run(current, "ReopenConversation", {
    reason: "patient_returned", owner: { kind: "ai", actorReference: "emma" },
  })).conversation;
  assert.equal(current.status, "Active");
});

test("failure recovery is explicit and limited to recoverable failures", () => {
  const f = createFixture();
  let current = f.activate();
  current = f.expectSuccess(f.run(current, "MarkConversationFailed", { failureCode: "temporary", recoverable: true })).conversation;
  current = f.expectSuccess(f.run(current, "RecoverConversation", {
    reason: "condition_cleared", owner: { kind: "ai", actorReference: "emma" },
  })).conversation;
  assert.equal(current.status, "Active");

  current = f.expectSuccess(f.run(current, "MarkConversationFailed", { failureCode: "invariant", recoverable: false })).conversation;
  const rejected = f.run(current, "RecoverConversation", {
    reason: "unsafe", owner: { kind: "ai", actorReference: "emma" },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.failure.code, "ConversationNotRecoverable");
});

test("reactivation response can convert to booking and opt-out is irreversible", () => {
  const f = createFixture();
  let current = f.activate();
  current = f.expectSuccess(f.run(current, "RecordReactivationResponse", {
    campaignReference: "campaign-a", outreachSequenceReference: "sequence-a", response: "converted_to_booking",
  }, { kind: "Patient" })).conversation;
  assert.equal(current.booking.operation, "create");
  current = f.expectSuccess(f.run(current, "RecordReactivationResponse", {
    campaignReference: "campaign-a", outreachSequenceReference: "sequence-a", response: "opted_out",
  }, { kind: "Patient" })).conversation;
  assert.equal(current.reactivation.response, "opted_out");
  const reverse = f.run(current, "RecordReactivationResponse", {
    campaignReference: "campaign-a", outreachSequenceReference: "sequence-a", response: "interested",
  }, { kind: "Patient" });
  assert.equal(reverse.ok, false);
  assert.equal(reverse.failure.code, "InvalidCommand");
});

test("duplicate command and inbound message contracts return typed outcomes", () => {
  const f = createFixture();
  const current = f.activate();
  const duplicateCommand = f.run(current, "MarkAwaitingUser", { reason: "duplicate" }, {}, {
    duplicate: { kind: "command", prior: { commandId: "prior-command", resultingVersion: current.version, outcomeReference: "prior-outcome" } },
  });
  assert.equal(duplicateCommand.ok, false);
  assert.equal(duplicateCommand.failure.code, "DuplicateCommand");
  const duplicateInbound = f.run(current, "RecordInboundMessage", {
    messageId: f.ids.messageId("duplicate-message"), author: f.actor("Patient"), content: "duplicate", externalMessageReference: "duplicate", receivedAt: "2026-07-20T00:50:00.000Z",
  }, { kind: "Patient" }, { duplicate: { kind: "inbound_message", messageId: f.ids.messageId("duplicate-message") } });
  assert.equal(duplicateInbound.ok, false);
  assert.equal(duplicateInbound.failure.code, "DuplicateInboundMessage");
});

test("optimistic concurrency and cross-tenant commands fail closed", () => {
  const f = createFixture();
  const current = f.activate();
  const stale = f.run(current, "MarkAwaitingUser", { reason: "stale" }, { expectedVersion: current.version - 1 });
  assert.equal(stale.ok, false);
  assert.equal(stale.failure.code, "ConcurrencyConflict");
  assert.equal(stale.failure.retryable, true);
  const crossTenant = f.run(current, "MarkAwaitingUser", { reason: "cross" }, { tenant: f.otherTenant });
  assert.equal(crossTenant.ok, false);
  assert.equal(crossTenant.failure.code, "TenantMismatch");
});

test("stale confirmations and stale tool results are rejected", () => {
  const f = createFixture();
  let current = f.bookingReady();
  current = f.expectSuccess(f.run(current, "RequestConfirmation", {
    effectDigest: "effect-a", summaryReference: "summary-a",
  }, { kind: "AiAgent", delegationVersion: current.version })).conversation;
  const confirmation = f.run(current, "RecordPatientConfirmation", { effectDigest: "effect-b" }, { kind: "Patient" });
  assert.equal(confirmation.ok, false);
  assert.equal(confirmation.failure.code, "StaleConfirmation");
  const tool = f.run(current, "RecordToolSucceeded", {
    toolIntentId: f.ids.toolIntentId("tool-stale"), effectDigest: "effect-a", outcomeReference: "none", nextStatus: "Active",
  });
  assert.equal(tool.ok, false);
  assert.equal(tool.failure.code, "StaleToolResult");
});
