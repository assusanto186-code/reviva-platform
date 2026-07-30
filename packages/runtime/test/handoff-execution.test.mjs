import assert from "node:assert/strict";
import test from "node:test";

import {
  TenantScopeMismatch,
  auditEntryId,
  commandId,
  conversationEventId,
  correlationId,
  handoffId,
  transactionId,
} from "@reviva/conversation";
import {
  InvalidExecutionRecordTransition,
  createExecutionRecord,
  handoffTransitionId,
  transitionExecutionRecord,
  transitionHandoff,
} from "../dist/index.js";
import { createRuntimeFixture } from "./fixtures.mjs";

const handoffActor = (
  tenantId,
  correlation,
  {
    kind = "Staff",
    actorReference = "operator-runtime",
    role = "manager",
  } = {},
) => ({
  kind,
  actorReference,
  authenticatedPrincipalReference:
    kind === "Staff" || kind === "HumanOperator"
      ? `${actorReference}-principal`
      : null,
  delegationReference: null,
  tenantId,
  correlationId: correlation,
  causationId: null,
  role,
});

const transitionRequest = (
  fixture,
  serial,
  action,
  expectedVersion,
  overrides = {},
) => {
  const corr = correlationId(`handoff-correlation-${serial}`);
  return {
    action,
    transitionId: handoffTransitionId(`handoff-transition-${serial}`),
    transactionId: transactionId(`handoff-transaction-${serial}`),
    auditEntryId: auditEntryId(`handoff-audit-${serial}`),
    commandId: commandId(`handoff-command-${serial}`),
    eventId: conversationEventId(`handoff-event-${serial}`),
    handoffId: handoffId("handoff-runtime"),
    tenantId: fixture.conversation.tenantId,
    conversationId: fixture.conversation.id,
    expectedVersion,
    actor: handoffActor(
      fixture.conversation.tenantId,
      corr,
      overrides.actor,
    ),
    reasonCode: overrides.reasonCode ?? `handoff_${action}`,
    targetQueueReference:
      action === "request" ? "queue-front-desk" : null,
    assigneeReference:
      action === "assign" ? "operator-runtime" : null,
    returnToAutomation:
      action === "return_to_automation"
        ? {
            freshDelegationReference: {
              id: `handoff-return-delegation-${serial}`,
              issuedForConversationVersion:
                fixture.conversation.version + 2,
            },
            aiActorReference: "emma-runtime",
          }
        : null,
    occurredAt: `2026-07-29T01:${String(serial).padStart(2, "0")}:00.000Z`,
    correlationId: corr,
    ...overrides.root,
  };
};

test("human handoff follows the closed lifecycle and preserves immutable history", async () => {
  const fixture = await createRuntimeFixture();
  const steps = [
    ["request", { kind: "Patient", actorReference: "patient-runtime", role: null }],
    ["queue", { kind: "System", actorReference: "handoff-router", role: null }],
    ["assign", { kind: "Staff", actorReference: "manager-runtime", role: "manager" }],
    ["accept", { kind: "HumanOperator", actorReference: "operator-runtime", role: "agent" }],
    ["resolve", { kind: "HumanOperator", actorReference: "operator-runtime", role: "agent" }],
    ["return_to_automation", { kind: "Staff", actorReference: "manager-runtime", role: "manager" }],
  ];
  let record = null;
  let lastRequest;
  for (const [index, [action, actor]] of steps.entries()) {
    lastRequest = transitionRequest(
      fixture,
      index + 1,
      action,
      index,
      { actor },
    );
    const result =
      await fixture.composition.handoffs.transition(lastRequest);
    assert.equal(result.ok, true);
    assert.equal(result.duplicate, false);
    assert.equal(result.record.version, index + 1);
    assert.equal(result.record.transitions.length, index + 1);
    record = result.record;
  }
  assert.equal(record.status, "ReturnedToAutomation");
  assert.equal(record.assigneeReference, "operator-runtime");
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.transitions), true);

  const projection =
    await fixture.persistence.transactionManager.runInTransaction(
      {
        id: transactionId("handoff-projection-inspection"),
        tenantId: fixture.conversation.tenantId,
      },
      (transaction) =>
        fixture.persistence.projections.get(
          transaction,
          fixture.conversation.tenantId,
          fixture.conversation.id,
        ),
    );
  assert.equal(projection.projection.status, "Active");
  assert.equal(
    projection.projection.handoff.aiOperatingMode,
    "autonomous",
  );

  const duplicate =
    await fixture.composition.handoffs.transition(lastRequest);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.record.version, 6);
});

test("handoff rejects stale, invalid, wrong-role, and wrong-assignment transitions", async (t) => {
  const fixture = await createRuntimeFixture();
  const requested = await fixture.composition.handoffs.transition(
    transitionRequest(fixture, 10, "request", 0, {
      actor: {
        kind: "Patient",
        actorReference: "patient-runtime",
        role: null,
      },
    }),
  );
  assert.equal(requested.ok, true);

  await t.test("stale version", async () => {
    const result = await fixture.composition.handoffs.transition(
      transitionRequest(fixture, 11, "queue", 0, {
        actor: { kind: "System", actorReference: "router", role: null },
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.failure.code, "HandoffStaleVersion");
  });

  await t.test("wrong role", async () => {
    const result = await fixture.composition.handoffs.transition(
      transitionRequest(fixture, 12, "queue", 1, {
        actor: {
          kind: "Staff",
          actorReference: "viewer-runtime",
          role: "viewer",
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.failure.code, "HandoffActorNotAllowed");
  });

  await t.test("invalid transition", async () => {
    const result = await fixture.composition.handoffs.transition(
      transitionRequest(fixture, 13, "resolve", 1, {
        actor: {
          kind: "HumanOperator",
          actorReference: "operator-runtime",
          role: "agent",
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.failure.code, "HandoffTransitionNotAllowed");
  });
});

test("pure handoff transition detects tenant and assignment mismatch", async () => {
  const fixture = await createRuntimeFixture();
  const request = transitionRequest(fixture, 20, "request", 0, {
    actor: {
      kind: "Patient",
      actorReference: "patient-runtime",
      role: null,
    },
  });
  const created = transitionHandoff(null, request);
  assert.equal(created.ok, true);

  const wrongTenant = {
    ...transitionRequest(fixture, 21, "queue", 1, {
      actor: { kind: "System", actorReference: "router", role: null },
    }),
    tenantId: "tenant-other",
  };
  wrongTenant.actor = {
    ...wrongTenant.actor,
    tenantId: "tenant-other",
  };
  const tenantResult = transitionHandoff(created.record, wrongTenant);
  assert.equal(tenantResult.ok, false);
  assert.equal(tenantResult.failure.code, "HandoffTenantMismatch");

  const queued = transitionHandoff(
    created.record,
    transitionRequest(fixture, 22, "queue", 1, {
      actor: { kind: "System", actorReference: "router", role: null },
    }),
  );
  const assigned = transitionHandoff(
    queued.record,
    transitionRequest(fixture, 23, "assign", 2, {
      actor: {
        kind: "Staff",
        actorReference: "manager-runtime",
        role: "manager",
      },
    }),
  );
  const wrongAssignee = transitionHandoff(
    assigned.record,
    transitionRequest(fixture, 24, "accept", 3, {
      actor: {
        kind: "HumanOperator",
        actorReference: "other-operator",
        role: "agent",
      },
    }),
  );
  assert.equal(wrongAssignee.ok, false);
  assert.equal(
    wrongAssignee.failure.code,
    "HandoffAssignmentMismatch",
  );
});

test("execution record lifecycle is closed, deterministic, and safe", async () => {
  const fixture = await createRuntimeFixture();
  const request = fixture.request();
  const proposed = createExecutionRecord(request);
  const validated = transitionExecutionRecord(proposed, {
    to: "Validated",
    occurredAt: request.transaction.requestedAt,
    reasonCode: "validated",
  });
  const executing = transitionExecutionRecord(validated, {
    to: "Executing",
    occurredAt: request.transaction.requestedAt,
    reasonCode: "executing",
    incrementAttempt: true,
  });
  const reconciled = transitionExecutionRecord(executing, {
    to: "ReconciliationRequired",
    occurredAt: request.transaction.requestedAt,
    reasonCode: "remote_outcome_unknown",
    failureCode: "ExternalEffectUncertain",
    reconciliationMetadata: { reference: "safe-reference" },
  });
  assert.deepEqual(
    reconciled.transitions.map(({ from, to }) => [from, to]),
    [
      [null, "Proposed"],
      ["Proposed", "Validated"],
      ["Validated", "Executing"],
      ["Executing", "ReconciliationRequired"],
    ],
  );
  assert.equal(reconciled.attemptCount, 1);
  assert.equal(
    JSON.stringify(reconciled).includes("connection"),
    false,
  );
  assert.throws(
    () =>
      transitionExecutionRecord(proposed, {
        to: "Succeeded",
        occurredAt: request.transaction.requestedAt,
        reasonCode: "invalid",
      }),
    InvalidExecutionRecordTransition,
  );
});

test("reference repositories enforce tenant scope", async () => {
  const fixture = await createRuntimeFixture();
  const request = fixture.request();
  const context = await fixture.persistence.transactionManager.begin({
    id: transactionId("tenant-scope-transaction"),
    tenantId: request.tenantId,
  });
  await assert.rejects(
    fixture.persistence.executionRecords.get(
      context,
      "tenant-other",
      request.runtimeExecutionId,
    ),
    TenantScopeMismatch,
  );
  await fixture.persistence.transactionManager.rollback(context);
});
