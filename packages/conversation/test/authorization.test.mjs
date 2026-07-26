import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeCapability,
  capabilities,
  capability,
  capabilitySetHas,
  createCapabilitySet,
  intersectCapabilitySets,
  InvalidCapability,
} from "../dist/index.js";
import { createAuthorizationFixture } from "./authorization-fixtures.mjs";

test("canonical capabilities are unique and reject unknown values", () => {
  assert.equal(new Set(capabilities).size, capabilities.length);
  assert.equal(Object.isFrozen(capabilities), true);
  assert.equal(capability("booking.create"), "booking.create");
  assert.throws(() => capability("booking.*"), InvalidCapability);
});

test("capability sets are immutable, canonical, and intersect deterministically", () => {
  const broad = createCapabilitySet([
    "booking.create",
    "conversation.read",
    "booking.create",
  ]);
  const narrow = createCapabilitySet(["conversation.read"]);
  const effective = intersectCapabilitySets(broad, narrow);

  assert.deepEqual(effective.values, ["conversation.read"]);
  assert.equal(capabilitySetHas(effective, "booking.create"), false);
  assert.equal(Object.isFrozen(effective), true);
  assert.equal(Object.isFrozen(effective.values), true);
});

test("a fully authorized request is allowed", () => {
  const fixture = createAuthorizationFixture();
  assert.deepEqual(
    authorizeCapability(fixture.context({
      requestedCapability: "conversation.read",
    })),
    {
      type: "Allowed",
      capability: "conversation.read",
      reason: "authorized",
    },
  );
});

for (const [scope, property, reason] of [
  ["global", "globalAuthority", "capability_not_globally_allowed"],
  ["subscription", "subscriptionAuthority", "capability_not_in_subscription"],
  ["tenant", "tenantAuthority", "capability_disabled_by_tenant"],
  ["location", "locationAuthority", "capability_disabled_by_location"],
  ["actor", "actorAuthority", "actor_not_authorized"],
]) {
  test(`${scope} authority can only narrow effective authority`, () => {
    const fixture = createAuthorizationFixture();
    const empty = createCapabilitySet([]);
    const override = property === "locationAuthority"
      ? { [property]: { mode: "restricted", capabilities: empty } }
      : { [property]: empty };
    const result = authorizeCapability(fixture.context({
      requestedCapability: "booking.create",
      confirmation: { status: "current", effectDigest: "effect-a" },
      effectDigest: "effect-a",
      ...override,
    }));

    assert.equal(result.type, "Denied");
    assert.equal(result.reason, reason);
  });
}

test("inactive staff membership denies before role authority can be used", () => {
  const fixture = createAuthorizationFixture();
  const result = authorizeCapability(fixture.context({
    membership: { status: "disabled", role: "owner" },
  }));
  assert.equal(result.reason, "membership_not_active");
});

test("missing required location authority denies instead of throwing", () => {
  const fixture = createAuthorizationFixture();
  const result = authorizeCapability(fixture.context({
    locationAuthority: undefined,
  }));
  assert.equal(result.type, "Denied");
  assert.equal(result.reason, "invalid_authorization_context");
});

test("missing and stale AI delegation deny deterministically", () => {
  const fixture = createAuthorizationFixture();
  const missing = authorizeCapability(fixture.aiContext("conversation.respond", {
    delegation: { status: "missing" },
  }));
  const stale = authorizeCapability(fixture.aiContext("conversation.respond", {
    delegation: {
      status: "active",
      reference: "delegation-a",
      capabilities: fixture.all,
      toolIdentifiers: [],
      issuedForConversationVersion: fixture.conversation.version - 1,
    },
  }));
  assert.equal(missing.reason, "delegation_missing");
  assert.equal(stale.reason, "delegation_stale");
});

test("booking creation requires matching patient confirmation", () => {
  const fixture = createAuthorizationFixture();
  const missing = authorizeCapability(fixture.aiContext("booking.create", {
    effectDigest: "booking-a",
    confirmation: { status: "missing", effectDigest: null },
  }));
  const current = authorizeCapability(fixture.aiContext("booking.create", {
    effectDigest: "booking-a",
    confirmation: { status: "current", effectDigest: "booking-a" },
  }));
  assert.equal(missing.type, "ConfirmationRequired");
  assert.equal(missing.reason, "patient_confirmation_required");
  assert.equal(current.type, "Allowed");
});

test("material booking modification requires fresh matching confirmation", () => {
  const fixture = createAuthorizationFixture();
  const stale = authorizeCapability(fixture.aiContext("booking.modify", {
    effectDigest: "modified-b",
    confirmation: { status: "stale", effectDigest: "original-a" },
  }));
  assert.equal(stale.type, "ConfirmationRequired");
  assert.equal(stale.reason, "fresh_confirmation_required");
});

test("autonomous cancellation always requires human approval", () => {
  const fixture = createAuthorizationFixture();
  const result = authorizeCapability(fixture.aiContext("booking.cancel.request", {
    effectDigest: "cancel-a",
    humanApproval: {
      status: "current",
      effectDigest: "cancel-a",
      approverReference: "operator-a",
    },
  }));
  assert.equal(result.type, "HumanApprovalRequired");
});

test("human cancellation requires matching approval and then becomes eligible", () => {
  const fixture = createAuthorizationFixture();
  const missing = authorizeCapability(fixture.context({
    requestedCapability: "booking.cancel.request",
    effectDigest: "cancel-a",
  }));
  const current = authorizeCapability(fixture.context({
    requestedCapability: "booking.cancel.request",
    effectDigest: "cancel-a",
    humanApproval: {
      status: "current",
      effectDigest: "cancel-a",
      approverReference: "operator-a",
    },
  }));
  assert.equal(missing.type, "HumanApprovalRequired");
  assert.equal(current.type, "Allowed");
});

test("handed-off conversations deny autonomous effects and distinguish assist-only", () => {
  const fixture = createAuthorizationFixture();
  const handedOff = {
    ...fixture.conversation,
    status: "HandedOff",
    handoff: {
      id: fixture.ids.handoffId("handoff-a"),
      reason: "operator requested",
      urgency: "Normal",
      requestedAt: "2026-07-23T00:00:00.000Z",
      requestedBy: fixture.actor("Staff"),
      targetQueueReference: "front-desk",
      assigneeReference: "operator-a",
      acceptedAt: "2026-07-23T00:01:00.000Z",
      resolvedAt: null,
      resolution: null,
      aiOperatingMode: "assist_only",
      responseDeadline: null,
    },
  };
  const result = authorizeCapability(fixture.aiContext("conversation.respond", {
    conversation: handedOff,
    delegation: {
      status: "active",
      reference: "delegation-a",
      capabilities: fixture.all,
      toolIdentifiers: [],
      issuedForConversationVersion: handedOff.version,
    },
  }));
  assert.equal(result.type, "Denied");
  assert.equal(result.reason, "assist_only_no_execution");
});

test("closed and nonrecoverable failed conversations deny state-incompatible actions", () => {
  const fixture = createAuthorizationFixture();
  const closed = authorizeCapability(fixture.context({
    conversation: { ...fixture.conversation, status: "Closed" },
    requestedCapability: "conversation.respond",
  }));
  const failed = authorizeCapability(fixture.context({
    conversation: {
      ...fixture.conversation,
      status: "Failed",
      failure: { code: "terminal", recoverable: false },
    },
    requestedCapability: "conversation.recover",
  }));
  assert.equal(closed.reason, "conversation_state_disallows_action");
  assert.equal(failed.reason, "conversation_state_disallows_action");
});

test("reactivation requires an approved basis and ceases after opt-out", () => {
  const fixture = createAuthorizationFixture();
  const missing = authorizeCapability(fixture.aiContext("reactivation.start", {
    reactivationCommunicationBasis: "missing",
  }));
  const optedOut = authorizeCapability(fixture.aiContext("reactivation.start", {
    conversation: {
      ...fixture.conversation,
      reactivation: {
        campaignReference: "campaign-a",
        outreachSequenceReference: "sequence-a",
        response: "opted_out",
        optedOutAt: "2026-07-23T00:00:00.000Z",
      },
    },
  }));
  assert.equal(missing.reason, "reactivation_basis_required");
  assert.equal(optedOut.reason, "reactivation_opted_out");
});

test("automation resume requires an authorized human and fresh delegation", () => {
  const fixture = createAuthorizationFixture();
  const deniedAi = authorizeCapability(fixture.aiContext("automation.resume"));
  const allowedHuman = authorizeCapability(fixture.context({
    actor: {
      kind: "HumanOperator",
      actorReference: "operator-a",
      authenticatedPrincipalReference: "principal-a",
    },
    requestedCapability: "automation.resume",
    delegation: {
      status: "active",
      reference: "fresh-delegation",
      capabilities: fixture.all,
      toolIdentifiers: [],
      issuedForConversationVersion: fixture.conversation.version,
    },
  }));
  assert.equal(deniedAi.reason, "actor_not_authorized");
  assert.equal(allowedHuman.type, "Allowed");
});

test("repeated evaluation returns an identical immutable decision", () => {
  const fixture = createAuthorizationFixture();
  const context = fixture.context({ requestedCapability: "knowledge.read" });
  const first = authorizeCapability(context);
  const second = authorizeCapability(context);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
});
