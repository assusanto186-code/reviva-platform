import assert from "node:assert/strict";
import test from "node:test";

import { authorizeCapability } from "../dist/index.js";
import { createAuthorizationFixture } from "./authorization-fixtures.mjs";

test("policy matrix covers actor, state, confirmation, handoff, and delegation axes", async (t) => {
  const fixture = createAuthorizationFixture();
  const matrix = [
    {
      name: "staff active read",
      context: fixture.context(),
      type: "Allowed",
    },
    {
      name: "AI active delegated response",
      context: fixture.aiContext("conversation.respond"),
      type: "Allowed",
    },
    {
      name: "AI missing delegation",
      context: fixture.aiContext("conversation.respond", {
        delegation: { status: "missing" },
      }),
      type: "Denied",
    },
    {
      name: "AI booking without confirmation",
      context: fixture.aiContext("booking.create", {
        effectDigest: "booking-a",
        confirmation: { status: "missing", effectDigest: null },
      }),
      type: "ConfirmationRequired",
    },
    {
      name: "AI cancellation",
      context: fixture.aiContext("booking.cancel.request"),
      type: "HumanApprovalRequired",
    },
    {
      name: "patient outside conversation",
      context: fixture.context({
        actor: {
          kind: "Patient",
          actorReference: "patient-b",
          authenticatedPrincipalReference: null,
        },
        membership: { status: "not_applicable", role: null },
        participation: "none",
      }),
      type: "Denied",
    },
    {
      name: "closed conversation response",
      context: fixture.context({
        conversation: { ...fixture.conversation, status: "Closed" },
        requestedCapability: "conversation.respond",
      }),
      type: "Denied",
    },
    {
      name: "AI assist-only handoff",
      context: fixture.aiContext("conversation.respond", {
        conversation: {
          ...fixture.conversation,
          status: "HandedOff",
          handoff: {
            id: fixture.ids.handoffId("matrix-handoff"),
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
        },
      }),
      type: "Denied",
    },
  ];

  for (const row of matrix) {
    await t.test(row.name, () => {
      assert.equal(authorizeCapability(row.context).type, row.type);
    });
  }
});
