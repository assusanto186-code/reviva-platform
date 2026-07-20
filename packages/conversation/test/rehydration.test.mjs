import assert from "node:assert/strict";
import test from "node:test";

import {
  conversationEventId,
  conversationId,
  rehydrateConversation,
} from "../dist/index.js";
import { createFixture } from "./fixtures.mjs";

const historyFixture = () => {
  const f = createFixture();
  const events = [];
  let result = f.run(null, "StartConversation", {
    tenantId: f.tenant,
    locationId: f.location,
    channel: "web",
    participants: [{ id: "participant-a", kind: "Patient", actorReference: "patient-a", joinedAt: "2026-07-20T00:00:00.000Z" }],
    contactId: f.contact,
    initialOwner: { kind: "ai", actorReference: "emma" },
  });
  let outcome = f.expectSuccess(result);
  events.push(...outcome.events);
  let current = outcome.conversation;

  result = f.run(current, "RecordInboundMessage", {
    messageId: f.ids.messageId("message-a"),
    author: f.actor("Patient"),
    content: "Hello",
    externalMessageReference: "external-a",
    receivedAt: "2026-07-20T00:01:00.000Z",
  }, { kind: "Patient" });
  outcome = f.expectSuccess(result);
  events.push(...outcome.events);
  current = outcome.conversation;

  result = f.run(current, "MarkAwaitingUser", { reason: "answered" });
  outcome = f.expectSuccess(result);
  events.push(...outcome.events);
  return { f, events, projection: outcome.conversation };
};

test("event replay reconstructs the identical immutable projection", () => {
  const { events, projection } = historyFixture();
  const replay = rehydrateConversation(events);
  assert.equal(replay.ok, true);
  assert.deepEqual(replay.value, projection);
  assert.equal(Object.isFrozen(replay.value), true);
});

test("rehydration is deterministic across repeated execution", () => {
  const { events } = historyFixture();
  const first = rehydrateConversation(events);
  const second = rehydrateConversation(events);
  assert.deepEqual(first, second);
});

test("missing initial event is rejected", () => {
  const { events } = historyFixture();
  const result = rehydrateConversation(events.slice(1));
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "InvalidEventSequence");
});

test("sequence gaps and duplicate sequence are rejected", () => {
  const { events } = historyFixture();
  const gap = events.map((event, index) => index === 2 ? { ...event, sequence: 4 } : event);
  const gapResult = rehydrateConversation(gap);
  assert.equal(gapResult.ok, false);
  assert.equal(gapResult.failure.code, "InvalidEventSequence");

  const duplicateSequence = [
    events[0],
    events[1],
    { ...events[2], eventId: conversationEventId("event-new"), sequence: 2 },
  ];
  const duplicateResult = rehydrateConversation(duplicateSequence);
  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicateResult.failure.code, "InvalidEventSequence");
});

test("duplicate event identifiers are rejected", () => {
  const { events } = historyFixture();
  const duplicate = [events[0], events[1], { ...events[2], eventId: events[1].eventId }];
  const result = rehydrateConversation(duplicate);
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "InvalidEventSequence");
  assert.equal(result.failure.context.reason, "duplicate_event_id");
});

test("cross-tenant and cross-conversation events are rejected", () => {
  const { f, events } = historyFixture();
  const crossTenant = [events[0], { ...events[1], tenantId: f.otherTenant }];
  const tenantResult = rehydrateConversation(crossTenant);
  assert.equal(tenantResult.ok, false);
  assert.equal(tenantResult.failure.code, "TenantMismatch");

  const crossConversation = [events[0], { ...events[1], conversationId: conversationId("other-conversation") }];
  const conversationResult = rehydrateConversation(crossConversation);
  assert.equal(conversationResult.ok, false);
  assert.equal(conversationResult.failure.code, "TenantMismatch");
});

test("unsupported event versions fail closed", () => {
  const { events } = historyFixture();
  const unsupported = [events[0], { ...events[1], eventVersion: 2 }];
  const result = rehydrateConversation(unsupported);
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "UnsupportedEventVersion");
});

test("events following terminal closure are rejected unless reopening", () => {
  const f = createFixture();
  const events = [];
  let current = f.activate();
  // Rebuild a canonical history for this fixture using explicit commands.
  const startHistory = historyFixture();
  events.push(...startHistory.events.slice(0, 2));
  current = startHistory.events.length > 0
    ? rehydrateConversation(events).value
    : current;
  let outcome = f.expectSuccess(f.run(current, "CloseConversation", { reason: "closed" }));
  events.push(...outcome.events);
  current = outcome.conversation;
  const late = {
    ...startHistory.events[1],
    eventId: conversationEventId("late-event"),
    sequence: current.lastCommittedSequence + 1,
  };
  const result = rehydrateConversation([...events, late]);
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "InvalidStateTransition");
});
