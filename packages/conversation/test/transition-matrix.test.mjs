import assert from "node:assert/strict";
import test from "node:test";

import { createFixture } from "./fixtures.mjs";

const stateFixtures = () => {
  const build = {
    New: () => {
      const f = createFixture();
      return { f, current: f.start() };
    },
    Active: () => {
      const f = createFixture();
      return { f, current: f.activate() };
    },
    AwaitingUser: () => {
      const f = createFixture();
      let current = f.activate();
      current = f.expectSuccess(f.run(current, "MarkAwaitingUser", { reason: "waiting" })).conversation;
      return { f, current };
    },
    AwaitingConfirmation: () => {
      const f = createFixture();
      let current = f.bookingReady();
      current = f.expectSuccess(f.run(current, "RequestConfirmation", {
        effectDigest: "effect-a", summaryReference: "summary-a",
      }, { kind: "AiAgent", delegationVersion: current.version })).conversation;
      return { f, current };
    },
    AwaitingTool: () => {
      const f = createFixture();
      let current = f.confirmedBooking();
      current = f.expectSuccess(f.run(current, "RecordToolScheduled", {
        toolIntentId: f.ids.toolIntentId("tool-a"), action: "booking.create", effectDigest: "effect-a",
      })).conversation;
      return { f, current };
    },
    AwaitingHuman: () => {
      const f = createFixture();
      let current = f.activate();
      current = f.expectSuccess(f.run(current, "RequestHumanHandoff", {
        handoffId: f.ids.handoffId("handoff-a"), reason: "requested", urgency: "Normal", targetQueueReference: "queue-a", responseDeadline: null,
      })).conversation;
      return { f, current };
    },
    HandedOff: () => {
      const { f, current: awaiting } = build.AwaitingHuman();
      const current = f.expectSuccess(f.run(awaiting, "AcceptHumanHandoff", {
        handoffId: f.ids.handoffId("handoff-a"), assigneeReference: "operator-a",
      }, { kind: "HumanOperator" })).conversation;
      return { f, current };
    },
    Resolved: () => {
      const f = createFixture();
      let current = f.activate();
      current = f.expectSuccess(f.run(current, "ResolveConversation", { reason: "complete" })).conversation;
      return { f, current };
    },
    Closed: () => {
      const { f, current: resolved } = build.Resolved();
      const current = f.expectSuccess(f.run(resolved, "CloseConversation", { reason: "closed" })).conversation;
      return { f, current };
    },
    Failed: () => {
      const f = createFixture();
      let current = f.activate();
      current = f.expectSuccess(f.run(current, "MarkConversationFailed", { failureCode: "temporary", recoverable: true })).conversation;
      return { f, current };
    },
  };
  return build;
};

test("transition matrix has an assessed accepted transition for every state", async (t) => {
  const build = stateFixtures();
  const cases = [
    ["New", "RecordInboundMessage", (f) => ({ messageId: f.ids.messageId("new-message"), author: f.actor("Patient"), content: "start", externalMessageReference: "new", receivedAt: "2026-07-20T01:00:00.000Z" }), { kind: "Patient" }, "Active"],
    ["Active", "MarkAwaitingUser", () => ({ reason: "wait" }), {}, "AwaitingUser"],
    ["AwaitingUser", "RecordInboundMessage", (f) => ({ messageId: f.ids.messageId("reply"), author: f.actor("Patient"), content: "reply", externalMessageReference: "reply", receivedAt: "2026-07-20T01:01:00.000Z" }), { kind: "Patient" }, "Active"],
    ["AwaitingConfirmation", "RecordPatientConfirmation", () => ({ effectDigest: "effect-a" }), { kind: "Patient" }, "AwaitingConfirmation"],
    ["AwaitingTool", "RecordToolSucceeded", (f) => ({ toolIntentId: f.ids.toolIntentId("tool-a"), effectDigest: "effect-a", outcomeReference: "booking-a", nextStatus: "Active" }), {}, "Active"],
    ["AwaitingHuman", "AcceptHumanHandoff", (f) => ({ handoffId: f.ids.handoffId("handoff-a"), assigneeReference: "operator-a" }), { kind: "HumanOperator" }, "HandedOff"],
    ["HandedOff", "ResolveHumanHandoff", (f) => ({ handoffId: f.ids.handoffId("handoff-a"), resolution: "complete", nextStatus: "Resolved" }), { kind: "HumanOperator" }, "Resolved"],
    ["Resolved", "ReopenConversation", () => ({ reason: "new_need", owner: { kind: "ai", actorReference: "emma" } }), {}, "Active"],
    ["Closed", "ReopenConversation", () => ({ reason: "new_need", owner: { kind: "ai", actorReference: "emma" } }), {}, "Active"],
    ["Failed", "RecoverConversation", () => ({ reason: "recovered", owner: { kind: "ai", actorReference: "emma" } }), {}, "Active"],
  ];

  for (const [state, command, payload, options, expected] of cases) {
    await t.test(`${state} accepts ${command}`, () => {
      const { f, current } = build[state]();
      assert.equal(current.status, state);
      const result = f.run(current, command, payload(f), options);
      assert.equal(result.ok, true);
      assert.equal(result.value.conversation.status, expected);
      assert.equal(result.value.events.length, 1);
    });
  }
});

test("transition matrix assesses autonomous tool proposal behavior for every state", async (t) => {
  const build = stateFixtures();
  for (const state of Object.keys(build)) {
    await t.test(state, () => {
      const { f, current } = build[state]();
      const result = f.run(current, "ProposeToolAction", {
        toolIntentId: f.ids.toolIntentId(`tool-${state}`),
        action: "booking.availability.read",
        effectDigest: `effect-${state}`,
      }, { kind: "AiAgent", delegationVersion: current.version });

      if (state === "Active") {
        assert.equal(result.ok, true);
      } else {
        assert.equal(result.ok, false);
        assert.ok(["InvalidStateTransition", "HandoffRequired"].includes(result.failure.code));
      }
    });
  }
});
