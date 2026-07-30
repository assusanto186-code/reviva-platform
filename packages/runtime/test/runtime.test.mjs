import assert from "node:assert/strict";
import test from "node:test";

import {
  HiddenNestedTransaction,
  TransactionClosed,
  createCapabilitySet,
  toolIdentifier,
  transactionId,
} from "@reviva/conversation";
import {
  createRuntimeComposition,
  createRuntimeToolRegistry,
  runtimeHandlerIdentifier,
} from "../dist/index.js";
import {
  createRuntimeFixture,
  effectDigest,
  otherEffectDigest,
} from "./fixtures.mjs";

const localDescriptor = (overrides = {}) => ({
  identifier: toolIdentifier("availability.lookup"),
  name: "availability.lookup",
  version: "1",
  description: "Read bounded availability.",
  requiredCapability: "booking.availability.read",
  allowedActorKinds: ["AiAgent", "Staff", "HumanOperator"],
  confirmation: "never",
  humanApproval: "never",
  effect: "read_only",
  inputContract: "availability.lookup.input.v1",
  outputContract: "availability.lookup.output.v1",
  ...overrides,
});

let inspectionSerial = 0;

const registration = (
  handlerResult,
  {
    descriptor = localDescriptor(),
    effectClassification = "LocalTransactional",
    executionMode = "single_transaction",
    handler,
  } = {},
) => {
  const identifier = runtimeHandlerIdentifier(
    `${descriptor.identifier}.handler.v1`,
  );
  return {
    descriptor: {
      tool: descriptor,
      handlerIdentifier: identifier,
      executionMode,
      idempotency:
        effectClassification === "LocalTransactional"
          ? "optional"
          : "required",
      timeoutClass: "standard",
      effectClassification,
      resultSchema: `${descriptor.identifier}.runtime-result.v1`,
    },
    handler: handler ?? {
      identifier,
      toolIdentifier: descriptor.identifier,
      toolVersion: descriptor.version,
      handle: () => handlerResult,
    },
  };
};

const runtimeForRegistration = async (item, options = {}) => {
  const fixture = await createRuntimeFixture({
    registrations: [item],
    ...options,
  });
  const request = fixture.request({
    descriptor: item.descriptor,
    arguments: {},
    ...options.request,
  });
  return { fixture, request };
};

const inspect = async (fixture, request) =>
  fixture.persistence.transactionManager.runInTransaction(
    {
      id: transactionId(
        `inspection-${request.runtimeExecutionId}-${++inspectionSerial}`,
      ),
      tenantId: request.tenantId,
    },
    async (transaction) => ({
      events: await fixture.persistence.events.load(
        transaction,
        request.tenantId,
        request.conversationId,
      ),
      projection: await fixture.persistence.projections.get(
        transaction,
        request.tenantId,
        request.conversationId,
      ),
      snapshot: await fixture.persistence.snapshots.get(
        transaction,
        request.tenantId,
        request.conversationId,
      ),
      audit: await fixture.persistence.audit.listForAggregate(
        transaction,
        request.tenantId,
        request.conversationId,
      ),
      outbox:
        request.artifacts.outboxMessageId === null
          ? null
          : await fixture.persistence.outbox.get(
              transaction,
              request.tenantId,
              request.artifacts.outboxMessageId,
            ),
      execution: await fixture.persistence.executionRecords.get(
        transaction,
        request.tenantId,
        request.runtimeExecutionId,
      ),
      idempotency: await fixture.persistence.idempotency.get(transaction, {
        tenantId: request.tenantId,
        actorReference: request.actor.actorReference,
        operationId: request.transaction.operationId,
        key: request.idempotencyKey,
      }),
    }),
  );

test("confirmed booking execution commits event, projection, snapshot, audit, outbox, record, and idempotency atomically", async () => {
  const fixture = await createRuntimeFixture();
  const request = fixture.request();
  const result = await fixture.composition.toolRuntime.execute(request);
  assert.equal(result.status, "ExternalEffectDeferred");
  assert.equal(result.continuation.directive, "respond_to_patient");
  assert.equal(result.safeResult.deliveryStatus, "pending");
  assert.equal(result.domainEventIds.length, 1);
  assert.equal(result.outboxMessageIds.length, 1);
  assert.equal(result.auditEntryIds.length, 1);
  assert.equal(result.projectionVersion, fixture.conversation.version + 1);

  const state = await inspect(fixture, request);
  assert.equal(state.events.version, fixture.events.length + 1);
  assert.equal(state.projection.projection.version, result.projectionVersion);
  assert.equal(state.snapshot.snapshot.aggregateVersion, result.projectionVersion);
  assert.equal(state.audit.at(-1).action, "runtime.external_effect_deferred");
  assert.equal(state.outbox.state, "Pending");
  assert.equal(state.execution.status, "Succeeded");
  assert.equal(state.execution.attemptCount, 1);
  assert.equal(state.idempotency.state, "completed");
  assert.equal(
    JSON.stringify(state.outbox.payload).includes("function"),
    false,
  );
  assert.equal(
    /password|secret|token|postgres(?:ql)?:\/\//iu.test(
      JSON.stringify(state.outbox.payload),
    ),
    false,
  );
});

test("completed duplicate replays exact result and never invokes or enqueues twice", async () => {
  const fixture = await createRuntimeFixture();
  const request = fixture.request();
  const first = await fixture.composition.toolRuntime.execute(request);
  const second = await fixture.composition.toolRuntime.execute(request);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.status, "ExternalEffectDeferred");
  const state = await inspect(fixture, request);
  assert.equal(state.events.version, fixture.events.length + 1);
  assert.equal(state.audit.length, 1);
  assert.equal(state.outbox.state, "Pending");
});

test("concurrent duplicate is prevented before a second handler invocation", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let invocations = 0;
  const descriptor = localDescriptor();
  const item = registration(null, {
    descriptor,
    handler: {
      identifier: runtimeHandlerIdentifier(
        "availability.lookup.handler.v1",
      ),
      toolIdentifier: descriptor.identifier,
      toolVersion: descriptor.version,
      handle: async () => {
        invocations += 1;
        await gate;
        return {
          status: "Succeeded",
          safeResult: { available: true },
          conversationCommand: null,
        };
      },
    },
  });
  const { fixture, request } = await runtimeForRegistration(item);
  const firstPromise = fixture.composition.toolRuntime.execute(request);
  await Promise.resolve();
  const duplicate = await fixture.composition.toolRuntime.execute(request);
  release();
  const first = await firstPromise;
  assert.equal(first.status, "Succeeded");
  assert.equal(duplicate.status, "ExecutionAlreadyProcessing");
  assert.equal(invocations, 1);
});

test("persisted processing duplicate returns typed outcome without invoking handler", async () => {
  let invocations = 0;
  const item = registration({
    status: "Succeeded",
    safeResult: { available: true },
    conversationCommand: null,
  });
  item.handler.handle = () => {
    invocations += 1;
    return {
      status: "Succeeded",
      safeResult: { available: true },
      conversationCommand: null,
    };
  };
  const { fixture, request } = await runtimeForRegistration(item);
  await fixture.persistence.transactionManager.runInTransaction(
    {
      id: transactionId("processing-reservation-transaction"),
      tenantId: request.tenantId,
    },
    (transaction) =>
      fixture.persistence.idempotency.reserve(transaction, {
        tenantId: request.tenantId,
        actorReference: request.actor.actorReference,
        operationId: request.transaction.operationId,
        key: request.idempotencyKey,
        requestFingerprint: request.idempotencyFingerprint,
        reservedAt: request.transaction.requestedAt,
      }),
  );
  const result = await fixture.composition.toolRuntime.execute(request);
  assert.equal(result.status, "ExecutionAlreadyProcessing");
  assert.equal(invocations, 0);
});

test("same idempotency scope with another fingerprint is denied", async () => {
  const fixture = await createRuntimeFixture();
  const first = fixture.request();
  await fixture.composition.toolRuntime.execute(first);
  const second = fixture.request({
    arguments: {
      locationReference: "location-a",
      startTime: "2026-08-02T10:00:00.000Z",
    },
    root: { idempotencyKey: first.idempotencyKey },
  });
  const result = await fixture.composition.toolRuntime.execute(second);
  assert.equal(result.status, "Denied");
  assert.equal(result.failure.code, "IdempotencyPayloadMismatch");
});

test("missing, expired, or mismatched confirmation never executes booking handler", async (t) => {
  const cases = [
    [
      "missing",
      { confirmationEvidence: { status: "missing" } },
      "ConfirmationRequired",
    ],
    [
      "expired",
      {
        confirmationEvidence: {
          status: "expired",
          tenantId: "tenant-a",
          conversationId: "conversation-a",
          actorReference: "emma-runtime",
          effectDigest,
          conversationVersion: 6,
          correlationId: "will-be-replaced",
          recordedAt: "2026-07-29T00:00:00.000Z",
          expiresAt: "2026-07-29T00:01:00.000Z",
        },
      },
      "ConfirmationExpired",
    ],
    [
      "mismatched",
      {
        confirmationEvidence: {
          status: "current",
          tenantId: "tenant-other",
          conversationId: "conversation-a",
          actorReference: "emma-runtime",
          effectDigest,
          conversationVersion: 6,
          correlationId: "will-be-replaced",
          recordedAt: "2026-07-29T00:10:00.000Z",
          expiresAt: "2026-07-29T00:20:00.000Z",
        },
      },
      "ConfirmationContextMismatch",
    ],
  ];
  for (const [name, overrides, code] of cases) {
    await t.test(name, async () => {
      const fixture = await createRuntimeFixture();
      const base = fixture.input();
      const evidence = overrides.confirmationEvidence;
      if ("correlationId" in evidence) {
        evidence.correlationId = base.correlationId;
        evidence.conversationVersion = fixture.conversation.version;
      }
      const request = fixture.request({
        confirmationEvidence: evidence,
      });
      const result = await fixture.composition.toolRuntime.execute(request);
      assert.equal(
        result.status,
        code === "ConfirmationContextMismatch"
          ? "Denied"
          : "AwaitingConfirmation",
      );
      assert.equal(result.failure.code, code);
      assert.equal(result.domainEventIds.length, 0);
      assert.equal(result.outboxMessageIds.length, 0);
    });
  }
});

test("staff cancellation requires current, effect-scoped human approval", async (t) => {
  const validFixture = await createRuntimeFixture();
  const valid = validFixture.request({
    toolIdentifier: "booking.cancel",
    actorKind: "Staff",
  });
  const accepted =
    await validFixture.composition.toolRuntime.execute(valid);
  assert.equal(accepted.status, "ExternalEffectDeferred");
  assert.equal(accepted.safeResult.operation, "booking.cancel.request");

  await t.test("missing approval", async () => {
    const fixture = await createRuntimeFixture();
    const request = fixture.request({
      toolIdentifier: "booking.cancel",
      actorKind: "Staff",
      humanApprovalEvidence: { status: "missing" },
    });
    const result = await fixture.composition.toolRuntime.execute(request);
    assert.equal(result.status, "AwaitingHumanApproval");
    assert.equal(result.failure.code, "HumanApprovalRequired");
    assert.equal(result.continuation.directive, "await_operator_approval");
  });

  await t.test("expired approval", async () => {
    const fixture = await createRuntimeFixture();
    const raw = fixture.input({
      toolIdentifier: "booking.cancel",
      actorKind: "Staff",
    });
    const request = fixture.request({
      toolIdentifier: "booking.cancel",
      actorKind: "Staff",
      humanApprovalEvidence: {
        ...raw.humanApprovalEvidence,
        status: "expired",
        correlationId: raw.correlationId,
        expiresAt: "2026-07-29T00:01:00.000Z",
      },
    });
    const result = await fixture.composition.toolRuntime.execute(request);
    assert.equal(result.status, "AwaitingHumanApproval");
    assert.equal(result.failure.code, "ApprovalExpired");
  });

  await t.test("unrelated approval", async () => {
    const fixture = await createRuntimeFixture();
    const raw = fixture.input({
      toolIdentifier: "booking.cancel",
      actorKind: "Staff",
    });
    const request = fixture.request({
      toolIdentifier: "booking.cancel",
      actorKind: "Staff",
      humanApprovalEvidence: {
        ...raw.humanApprovalEvidence,
        effectDigest: otherEffectDigest,
      },
    });
    const result = await fixture.composition.toolRuntime.execute(request);
    assert.equal(result.status, "Denied");
    assert.equal(result.failure.code, "ApprovalContextMismatch");
  });
});

test("no-confirmation local operation executes with normalized continuation", async () => {
  const item = registration({
    status: "Succeeded",
    safeResult: { slots: 2 },
    conversationCommand: null,
  });
  const { fixture, request } = await runtimeForRegistration(item);
  const result = await fixture.composition.toolRuntime.execute(request);
  assert.equal(result.status, "Succeeded");
  assert.equal(result.safeResult.slots, 2);
  assert.equal(result.continuation.directive, "respond_to_patient");
  assert.equal(result.continuation.correlationId, request.correlationId);
  assert.equal(
    result.continuation.conversationVersion,
    request.expectedConversationVersion,
  );
});

test("authorization revalidation denies actor, delegation, schema, and handoff drift", async (t) => {
  await t.test("actor category", async () => {
    const fixture = await createRuntimeFixture();
    const result = await fixture.composition.toolRuntime.execute(
      fixture.request({ actorKind: "Patient" }),
    );
    assert.equal(result.failure.code, "ActorNotAllowed");
  });
  await t.test("delegation restriction", async () => {
    const fixture = await createRuntimeFixture();
    const result = await fixture.composition.toolRuntime.execute(
      fixture.request({
        delegation: {
          status: "active",
          reference: "delegation-restricted",
          capabilities: createCapabilitySet(["booking.create"]),
          toolIdentifiers: [],
          issuedForConversationVersion: fixture.conversation.version,
        },
      }),
    );
    assert.equal(result.failure.code, "DelegationDenied");
  });
  await t.test("schema capability mismatch", async () => {
    const fixture = await createRuntimeFixture();
    const result = await fixture.composition.toolRuntime.execute(
      fixture.request({
        proposal: { requiredCapability: "booking.modify" },
      }),
    );
    assert.equal(result.failure.code, "RuntimeToolSchemaMismatch");
  });
  await t.test("handoff restriction", async () => {
    const fixture = await createRuntimeFixture({ handedOff: true });
    const result = await fixture.composition.toolRuntime.execute(
      fixture.request(),
    );
    assert.equal(result.failure.code, "HandoffRestriction");
    assert.equal(result.continuation.directive, "handoff_to_human");
  });
});

test("unknown runtime tool is denied by a registry with no dynamic fallback", async () => {
  const fixture = await createRuntimeFixture();
  const request = fixture.request();
  const emptyRegistry = createRuntimeToolRegistry([]);
  const runtime = createRuntimeComposition({
    registry: emptyRegistry,
    persistence: fixture.persistence,
  }).toolRuntime;
  const result = await runtime.execute(request);
  assert.equal(result.status, "Denied");
  assert.equal(result.failure.code, "RuntimeToolNotRegistered");
});

test("handler outcomes normalize rejection, retry, definitive failure, and uncertainty", async (t) => {
  const cases = [
    ["Rejected", "HandlerRejected", "Failed", "report_safe_failure"],
    ["RetryableFailure", "HandlerRetryableFailure", "Failed", "report_safe_failure"],
    ["DefinitiveFailure", "HandlerDefinitiveFailure", "Failed", "report_safe_failure"],
  ];
  for (const [status, code, expectedStatus, directive] of cases) {
    await t.test(status, async () => {
      const item = registration({
        status,
        reasonCode: `scripted_${status.toLowerCase()}`,
        safeResult: null,
        conversationCommand: null,
      });
      const { fixture, request } = await runtimeForRegistration(item);
      const result = await fixture.composition.toolRuntime.execute(request);
      assert.equal(result.status, expectedStatus);
      assert.equal(result.failure.code, code);
      assert.equal(result.continuation.directive, directive);
      const state = await inspect(fixture, request);
      assert.equal(state.execution.status, "Failed");
      assert.equal(state.execution.safeFailureCode, code);
    });
  }

  await t.test("uncertain effect", async () => {
    let invocations = 0;
    const descriptor = localDescriptor();
    const item = registration(null, {
      descriptor,
      effectClassification: "SynchronousExternal",
      executionMode: "synchronous_external",
      handler: {
        identifier: runtimeHandlerIdentifier(
          "availability.lookup.handler.v1",
        ),
        toolIdentifier: descriptor.identifier,
        toolVersion: descriptor.version,
        handle: () => {
          invocations += 1;
          return {
            status: "ExternalEffectUncertain",
            reasonCode: "remote_outcome_unknown",
            reconciliationMetadata: { reference: "safe-reference" },
            safeResult: null,
            conversationCommand: null,
          };
        },
      },
    });
    const { fixture, request } = await runtimeForRegistration(item);
    const first = await fixture.composition.toolRuntime.execute(request);
    const replay = await fixture.composition.toolRuntime.execute(request);
    assert.equal(first.status, "ReconciliationRequired");
    assert.equal(first.reconciliation.retryBlindly, false);
    assert.equal(
      first.continuation.directive,
      "reconciliation_pending",
    );
    assert.equal(replay.replayed, true);
    assert.equal(invocations, 1);
  });
});

test("audit and outbox failures roll back domain and runtime drafts", async (t) => {
  for (const failing of ["audit", "outbox"]) {
    await t.test(failing, async () => {
      const fixture = await createRuntimeFixture();
      const request = fixture.request();
      const persistence = {
        ...fixture.persistence,
        [failing]: {
          ...fixture.persistence[failing],
          [failing === "audit" ? "append" : "enqueue"]: async () => {
            throw new Error(`${failing}_failed`);
          },
        },
      };
      const runtime = createRuntimeComposition({
        registry: fixture.registry,
        persistence,
      }).toolRuntime;
      const result = await runtime.execute(request);
      assert.equal(result.status, "Failed");
      assert.equal(
        result.failure.code,
        failing === "audit"
          ? "AuditWriteFailed"
          : "OutboxWriteFailed",
      );
      const state = await inspect(fixture, request);
      assert.equal(state.events.version, fixture.events.length);
      assert.equal(state.projection.projection.version, fixture.conversation.version);
      assert.equal(state.execution, null);
      assert.equal(state.idempotency, null);
      assert.equal(state.outbox, null);
      assert.equal(state.audit.length, 0);
    });
  }
});

test("projection conflict rolls back idempotency reservation", async () => {
  const fixture = await createRuntimeFixture();
  const first = fixture.request();
  await fixture.composition.toolRuntime.execute(first);
  const stale = fixture.request();
  const result = await fixture.composition.toolRuntime.execute(stale);
  assert.equal(result.status, "Failed");
  assert.equal(result.failure.code, "StaleConversationVersion");
  const state = await inspect(fixture, stale);
  assert.equal(state.idempotency, null);
  assert.equal(state.execution, null);
});

test("handler cannot commit independently and nested transaction is denied", async () => {
  let exposedCommit = true;
  let nestedDenied = false;
  let fixture;
  const descriptor = localDescriptor();
  const item = registration(null, {
    descriptor,
    handler: {
      identifier: runtimeHandlerIdentifier(
        "availability.lookup.handler.v1",
      ),
      toolIdentifier: descriptor.identifier,
      toolVersion: descriptor.version,
      handle: async (context) => {
        exposedCommit = typeof context.transaction.commit === "function";
        try {
          await fixture.persistence.transactionManager.runInTransaction(
            {
              id: transactionId("nested-runtime-transaction"),
              tenantId: context.request.tenantId,
            },
            () => undefined,
          );
        } catch (error) {
          nestedDenied = error instanceof HiddenNestedTransaction;
        }
        return {
          status: "Succeeded",
          safeResult: { checked: true },
          conversationCommand: null,
        };
      },
    },
  });
  ({ fixture } = await runtimeForRegistration(item));
  const request = fixture.request({
    descriptor: item.descriptor,
    arguments: {},
  });
  const result = await fixture.composition.toolRuntime.execute(request);
  assert.equal(result.status, "Succeeded");
  assert.equal(exposedCommit, false);
  assert.equal(nestedDenied, true);
});

test("transaction reuse and double completion are rejected", async () => {
  const fixture = await createRuntimeFixture();
  const context = await fixture.persistence.transactionManager.begin({
    id: transactionId("reuse-runtime-transaction"),
    tenantId: fixture.conversation.tenantId,
  });
  await fixture.persistence.transactionManager.commit(context);
  await assert.rejects(
    fixture.persistence.transactionManager.commit(context),
    TransactionClosed,
  );
  await assert.rejects(
    fixture.persistence.transactionManager.rollback(context),
    TransactionClosed,
  );
});
