import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalRequestFingerprint,
  conversationEventFromDto,
  conversationEventToDto,
  conversationSnapshotFromDto,
  conversationSnapshotToDto,
  createAuditEntry,
  createConversationSnapshot,
  createOutboxMessage,
  expectedVersion,
  HiddenNestedTransaction,
  IdempotencyPayloadMismatch,
  idempotencyRecordFromDto,
  idempotencyRecordToDto,
  InvalidOutboxTransition,
  InvalidPersistenceValue,
  outboxMessageFromDto,
  outboxMessageToDto,
  PersistenceConcurrencyConflict,
  PersistenceMappingFailure,
  rehydrateConversation,
  restoreConversationFromSnapshot,
  SnapshotIncompatible,
  TenantScopeMismatch,
  TransactionClosed,
} from "../dist/index.js";
import { createPersistenceFixture } from "./persistence-fixtures.mjs";

const seedHistory = async (fixture, count = 3) => {
  const history = fixture.history();
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.events.append(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
        expectedVersion(0),
        history.events.slice(0, count),
      );
      await fixture.persistence.projections.save(
        context,
        history.projections[count - 1],
        expectedVersion(0),
      );
    },
  );
  return history;
};

test("event repository appends and loads an immutable ordered stream", async () => {
  const fixture = createPersistenceFixture();
  const history = await seedHistory(fixture);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      const loaded = await fixture.persistence.events.load(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      );
      assert.equal(loaded.found, true);
      assert.equal(loaded.version, 3);
      assert.deepEqual(loaded.events, history.events);
      assert.equal(Object.isFrozen(loaded.events), true);
      assert.deepEqual(loaded.events.map((event) => event.sequence), [1, 2, 3]);
      assert.throws(() => loaded.events.push(history.events[0]), TypeError);
    },
  );
});

test("unknown streams are explicit and never fabricate an aggregate", async () => {
  const fixture = createPersistenceFixture();
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      const loaded = await fixture.persistence.events.load(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      );
      assert.deepEqual(loaded, { found: false, events: [] });
      await assert.rejects(
        fixture.persistence.projections.rebuild(
          context,
          fixture.domain.tenant,
          fixture.domain.conversation,
        ),
        { code: "ConversationStreamNotFound" },
      );
    },
  );
});

test("event append rejects stale versions and noncontiguous events", async () => {
  const fixture = createPersistenceFixture();
  const history = await seedHistory(fixture, 1);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await assert.rejects(
        fixture.persistence.events.append(
          context,
          fixture.domain.tenant,
          fixture.domain.conversation,
          expectedVersion(0),
          [history.events[1]],
        ),
        PersistenceConcurrencyConflict,
      );
      await assert.rejects(
        fixture.persistence.events.append(
          context,
          fixture.domain.tenant,
          fixture.domain.conversation,
          expectedVersion(1),
          [{ ...history.events[1], sequence: 3 }],
        ),
        InvalidPersistenceValue,
      );
    },
  );
});

test("concurrent transaction commits allow only one writer", async () => {
  const fixture = createPersistenceFixture();
  const history = await seedHistory(fixture, 1);
  const left = await fixture.persistence.transactionManager.begin(fixture.txInput());
  const right = await fixture.persistence.transactionManager.begin(fixture.txInput());
  await fixture.persistence.events.append(
    left,
    fixture.domain.tenant,
    fixture.domain.conversation,
    expectedVersion(1),
    [history.events[1]],
  );
  await fixture.persistence.events.append(
    right,
    fixture.domain.tenant,
    fixture.domain.conversation,
    expectedVersion(1),
    [history.events[1]],
  );
  await fixture.persistence.transactionManager.commit(left);
  await assert.rejects(
    fixture.persistence.transactionManager.commit(right),
    PersistenceConcurrencyConflict,
  );
});

test("event streams are tenant isolated", async () => {
  const fixture = createPersistenceFixture();
  await seedHistory(fixture);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(fixture.domain.otherTenant),
    async (context) => {
      const loaded = await fixture.persistence.events.load(
        context,
        fixture.domain.otherTenant,
        fixture.domain.conversation,
      );
      assert.equal(loaded.found, false);
      await assert.rejects(
        fixture.persistence.events.load(
          context,
          fixture.domain.tenant,
          fixture.domain.conversation,
        ),
        TenantScopeMismatch,
      );
    },
  );
});

test("projection save uses compare-and-set and rejects stale writes", async () => {
  const fixture = createPersistenceFixture();
  const history = await seedHistory(fixture);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      const loaded = await fixture.persistence.projections.get(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      );
      assert.equal(loaded.found, true);
      assert.deepEqual(loaded.projection, history.projection);
      await assert.rejects(
        fixture.persistence.projections.save(
          context,
          history.projection,
          expectedVersion(2),
        ),
        PersistenceConcurrencyConflict,
      );
    },
  );
});

test("projection rebuild derives the same state from authoritative events", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.events.append(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
        expectedVersion(0),
        history.events,
      );
      const rebuilt = await fixture.persistence.projections.rebuild(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      );
      assert.deepEqual(rebuilt, history.projection);
    },
  );
});

test("projections are tenant isolated", async () => {
  const fixture = createPersistenceFixture();
  await seedHistory(fixture);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(fixture.domain.otherTenant),
    async (context) => {
      const loaded = await fixture.persistence.projections.get(
        context,
        fixture.domain.otherTenant,
        fixture.domain.conversation,
      );
      assert.equal(loaded.found, false);
    },
  );
});

test("snapshot-assisted replay equals full event replay", async () => {
  const fixture = createPersistenceFixture();
  const history = await seedHistory(fixture);
  const snapshot = createConversationSnapshot(history.projections[1]);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.snapshots.save(
        context,
        snapshot,
        expectedVersion(0),
      );
      const stored = await fixture.persistence.snapshots.get(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      );
      assert.equal(stored.found, true);
      const restored = restoreConversationFromSnapshot(
        stored.snapshot,
        history.events.slice(2),
        3,
      );
      const full = rehydrateConversation(history.events);
      assert.equal(full.ok, true);
      assert.deepEqual(restored, full.value);
    },
  );
});

test("snapshots reject incompatible integrity and versions ahead of stream", async () => {
  const fixture = createPersistenceFixture();
  const history = await seedHistory(fixture, 2);
  const valid = createConversationSnapshot(history.projections[1]);
  const invalid = {
    ...valid,
    integrityFingerprint: `sha256:${"0".repeat(64)}`,
  };
  assert.throws(
    () => restoreConversationFromSnapshot(invalid, [], 2),
    SnapshotIncompatible,
  );
  assert.throws(
    () => restoreConversationFromSnapshot(
      { ...valid, schemaVersion: 2 },
      [],
      2,
    ),
    SnapshotIncompatible,
  );
  const ahead = createConversationSnapshot(history.projections[2]);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await assert.rejects(
        fixture.persistence.snapshots.save(
          context,
          ahead,
          expectedVersion(0),
        ),
        SnapshotIncompatible,
      );
    },
  );
});

test("snapshot writes enforce optimistic concurrency", async () => {
  const fixture = createPersistenceFixture();
  const history = await seedHistory(fixture);
  const second = createConversationSnapshot(history.projections[1]);
  const third = createConversationSnapshot(history.projections[2]);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.snapshots.save(
        context,
        second,
        expectedVersion(0),
      );
      await assert.rejects(
        fixture.persistence.snapshots.save(
          context,
          third,
          expectedVersion(0),
        ),
        PersistenceConcurrencyConflict,
      );
      await fixture.persistence.snapshots.save(
        context,
        third,
        expectedVersion(2),
      );
    },
  );
});

test("canonical fingerprints ignore object key order and reject sensitive keys", () => {
  assert.equal(
    canonicalRequestFingerprint({}),
    "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  );
  const first = canonicalRequestFingerprint({
    operation: "booking.create",
    payload: { b: 2, a: 1 },
  });
  const second = canonicalRequestFingerprint({
    payload: { a: 1, b: 2 },
    operation: "booking.create",
  });
  assert.equal(first, second);
  assert.throws(
    () => canonicalRequestFingerprint({ password: "must-not-be-hashed" }),
    InvalidPersistenceValue,
  );
});

test("expected versions and idempotency keys fail closed when malformed", async () => {
  const fixture = createPersistenceFixture();
  assert.throws(() => expectedVersion(-1), InvalidPersistenceValue);
  assert.throws(() => fixture.ids.idempotencyKey(" "), InvalidPersistenceValue);
});

test("idempotency reservation distinguishes in-progress and completed duplicates", async () => {
  const fixture = createPersistenceFixture();
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      const first = await fixture.persistence.idempotency.reserve(
        context,
        fixture.idempotency(),
      );
      assert.equal(first.kind, "reserved");
      const duplicate = await fixture.persistence.idempotency.reserve(
        context,
        fixture.idempotency(),
      );
      assert.equal(duplicate.kind, "in_progress");
      await fixture.persistence.idempotency.complete(context, {
        ...fixture.idempotency(),
        resultReference: fixture.ids.resultReference("result-a"),
        completedAt: "2026-07-25T00:04:00.000Z",
      });
    },
  );
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      const replay = await fixture.persistence.idempotency.reserve(
        context,
        fixture.idempotency(),
      );
      assert.equal(replay.kind, "completed");
      assert.equal(replay.record.resultReference, "result-a");
    },
  );
});

test("idempotency rejects a reused key with a different payload", async () => {
  const fixture = createPersistenceFixture();
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    (context) =>
      fixture.persistence.idempotency.reserve(context, fixture.idempotency()),
  );
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await assert.rejects(
        fixture.persistence.idempotency.reserve(
          context,
          fixture.idempotency({
            requestFingerprint: canonicalRequestFingerprint({ operation: "different" }),
          }),
        ),
        IdempotencyPayloadMismatch,
      );
    },
  );
});

test("idempotency records are tenant scoped", async () => {
  const fixture = createPersistenceFixture();
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    (context) =>
      fixture.persistence.idempotency.reserve(context, fixture.idempotency()),
  );
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(fixture.domain.otherTenant),
    async (context) => {
      const other = await fixture.persistence.idempotency.get(context, {
        ...fixture.idempotency(),
        tenantId: fixture.domain.otherTenant,
      });
      assert.equal(other, null);
    },
  );
});

test("successful transactions atomically persist all coordinated records", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const message = fixture.outbox(history.events[2]);
  const entry = fixture.audit(history.events[2]);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.events.append(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
        expectedVersion(0),
        history.events,
      );
      await fixture.persistence.projections.save(
        context,
        history.projection,
        expectedVersion(0),
      );
      await fixture.persistence.idempotency.reserve(
        context,
        fixture.idempotency(),
      );
      await fixture.persistence.outbox.enqueue(context, message);
      await fixture.persistence.audit.append(context, entry);
    },
  );
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      assert.equal((await fixture.persistence.events.load(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      )).found, true);
      assert.notEqual(await fixture.persistence.outbox.get(
        context,
        fixture.domain.tenant,
        message.id,
      ), null);
      assert.equal((await fixture.persistence.audit.listForAggregate(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      )).length, 1);
    },
  );
});

test("automatic rollback leaves no partial event, outbox, or audit writes", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const message = fixture.outbox(history.events[0]);
  await assert.rejects(
    fixture.persistence.transactionManager.runInTransaction(
      fixture.txInput(),
      async (context) => {
        await fixture.persistence.events.append(
          context,
          fixture.domain.tenant,
          fixture.domain.conversation,
          expectedVersion(0),
          history.events,
        );
        await fixture.persistence.outbox.enqueue(context, message);
        await fixture.persistence.audit.append(
          context,
          fixture.audit(history.events[0]),
        );
        throw new Error("deterministic_failure");
      },
    ),
    /deterministic_failure/u,
  );
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      assert.equal((await fixture.persistence.events.load(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      )).found, false);
      assert.equal(await fixture.persistence.outbox.get(
        context,
        fixture.domain.tenant,
        message.id,
      ), null);
      assert.equal((await fixture.persistence.audit.listForAggregate(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      )).length, 0);
    },
  );
});

test("explicit rollback discards writes", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const context = await fixture.persistence.transactionManager.begin(fixture.txInput());
  await fixture.persistence.events.append(
    context,
    fixture.domain.tenant,
    fixture.domain.conversation,
    expectedVersion(0),
    history.events,
  );
  await fixture.persistence.transactionManager.rollback(context);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (readContext) => {
      assert.equal((await fixture.persistence.events.load(
        readContext,
        fixture.domain.tenant,
        fixture.domain.conversation,
      )).found, false);
    },
  );
});

test("closed transactions reject reuse, double commit, and double rollback", async () => {
  const fixture = createPersistenceFixture();
  const committed = await fixture.persistence.transactionManager.begin(fixture.txInput());
  await fixture.persistence.transactionManager.commit(committed);
  await assert.rejects(
    fixture.persistence.transactionManager.commit(committed),
    TransactionClosed,
  );
  await assert.rejects(
    fixture.persistence.events.load(
      committed,
      fixture.domain.tenant,
      fixture.domain.conversation,
    ),
    TransactionClosed,
  );
  const rolledBack = await fixture.persistence.transactionManager.begin(fixture.txInput());
  await fixture.persistence.transactionManager.rollback(rolledBack);
  await assert.rejects(
    fixture.persistence.transactionManager.rollback(rolledBack),
    TransactionClosed,
  );
});

test("coordinated callbacks reject hidden nested transactions", async () => {
  const fixture = createPersistenceFixture();
  await assert.rejects(
    fixture.persistence.transactionManager.runInTransaction(
      fixture.txInput(),
      () => fixture.persistence.transactionManager.begin(fixture.txInput()),
    ),
    HiddenNestedTransaction,
  );
});

test("outbox retrieval is deterministic and tenant scoped", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const later = fixture.outbox(history.events[1], {
    id: fixture.ids.outboxMessageId("outbox-later"),
    availableAt: "2026-07-25T00:05:00.000Z",
    orderingSequence: 2,
  });
  const earlier = fixture.outbox(history.events[0], {
    id: fixture.ids.outboxMessageId("outbox-earlier"),
    orderingSequence: 1,
  });
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.outbox.enqueue(context, later);
      await fixture.persistence.outbox.enqueue(context, earlier);
      const eligible = await fixture.persistence.outbox.fetchEligible(
        context,
        fixture.domain.tenant,
        "2026-07-25T00:06:00.000Z",
        10,
      );
      assert.deepEqual(eligible.map((message) => message.id), [
        earlier.id,
        later.id,
      ]);
    },
  );
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(fixture.domain.otherTenant),
    async (context) => {
      const eligible = await fixture.persistence.outbox.fetchEligible(
        context,
        fixture.domain.otherTenant,
        "2026-07-25T00:06:00.000Z",
        10,
      );
      assert.deepEqual(eligible, []);
      assert.equal(await fixture.persistence.outbox.get(
        context,
        fixture.domain.otherTenant,
        earlier.id,
      ), null);
    },
  );
});

test("outbox supports claim, failure, retry claim, and publish", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const message = fixture.outbox(history.events[0]);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.outbox.enqueue(context, message);
      const claimed = await fixture.persistence.outbox.claim(
        context,
        fixture.domain.tenant,
        message.id,
        "2026-07-25T00:03:00.000Z",
      );
      assert.equal(claimed.state, "Processing");
      assert.equal(claimed.attemptCount, 1);
      const failed = await fixture.persistence.outbox.recordFailure(
        context,
        fixture.domain.tenant,
        message.id,
        "provider_unavailable",
        "2026-07-25T00:04:00.000Z",
      );
      assert.equal(failed.state, "Failed");
      const retried = await fixture.persistence.outbox.claim(
        context,
        fixture.domain.tenant,
        message.id,
        "2026-07-25T00:04:00.000Z",
      );
      assert.equal(retried.attemptCount, 2);
      const published = await fixture.persistence.outbox.markPublished(
        context,
        fixture.domain.tenant,
        message.id,
        "2026-07-25T00:05:00.000Z",
      );
      assert.equal(published.state, "Published");
    },
  );
});

test("published outbox messages cannot return to processing or pending", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const message = fixture.outbox(history.events[0]);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.outbox.enqueue(context, message);
      await fixture.persistence.outbox.claim(
        context,
        fixture.domain.tenant,
        message.id,
        "2026-07-25T00:03:00.000Z",
      );
      await fixture.persistence.outbox.markPublished(
        context,
        fixture.domain.tenant,
        message.id,
        "2026-07-25T00:04:00.000Z",
      );
      await assert.rejects(
        fixture.persistence.outbox.claim(
          context,
          fixture.domain.tenant,
          message.id,
          "2026-07-25T00:05:00.000Z",
        ),
        InvalidOutboxTransition,
      );
    },
  );
});

test("outbox rollback removes an uncommitted message", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const message = fixture.outbox(history.events[0]);
  const context = await fixture.persistence.transactionManager.begin(fixture.txInput());
  await fixture.persistence.outbox.enqueue(context, message);
  await fixture.persistence.transactionManager.rollback(context);
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (readContext) => {
      assert.equal(await fixture.persistence.outbox.get(
        readContext,
        fixture.domain.tenant,
        message.id,
      ), null);
    },
  );
});

test("audit entries are append-only, ordered, and tenant scoped", async () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const later = fixture.audit(history.events[1], {
    id: fixture.ids.auditEntryId("audit-later"),
    occurredAt: "2026-07-25T00:05:00.000Z",
  });
  const earlier = fixture.audit(history.events[0], {
    id: fixture.ids.auditEntryId("audit-earlier"),
    occurredAt: "2026-07-25T00:04:00.000Z",
  });
  await fixture.persistence.transactionManager.runInTransaction(
    fixture.txInput(),
    async (context) => {
      await fixture.persistence.audit.append(context, later);
      await fixture.persistence.audit.append(context, earlier);
      const entries = await fixture.persistence.audit.listForAggregate(
        context,
        fixture.domain.tenant,
        fixture.domain.conversation,
      );
      assert.deepEqual(entries.map((entry) => entry.id), [
        earlier.id,
        later.id,
      ]);
      assert.equal(Object.isFrozen(entries), true);
      await assert.rejects(
        fixture.persistence.audit.append(context, earlier),
        { code: "DuplicatePersistenceIdentifier" },
      );
    },
  );
});

test("audit metadata rejects credential-bearing keys", () => {
  const fixture = createPersistenceFixture();
  const event = fixture.history().events[0];
  assert.throws(
    () => createAuditEntry({
      ...fixture.audit(event),
      metadata: { accessToken: "forbidden" },
    }),
    InvalidPersistenceValue,
  );
  assert.throws(
    () => createAuditEntry({
      ...fixture.audit(event),
      metadata: { reference: ["postgresql:", "//credential-bearing-value"].join("") },
    }),
    InvalidPersistenceValue,
  );
});

test("persistence DTO mappers round-trip supported immutable records", () => {
  const fixture = createPersistenceFixture();
  const history = fixture.history();
  const event = history.events[0];
  const snapshot = createConversationSnapshot(history.projections[0]);
  const outbox = fixture.outbox(event);
  const idempotency = {
    ...fixture.idempotency(),
    state: "processing",
    completedAt: null,
    resultReference: null,
    failureCode: null,
  };
  assert.deepEqual(
    conversationEventFromDto(conversationEventToDto(event)),
    event,
  );
  assert.deepEqual(
    conversationSnapshotFromDto(conversationSnapshotToDto(snapshot)),
    snapshot,
  );
  assert.deepEqual(outboxMessageFromDto(outboxMessageToDto(outbox)), outbox);
  assert.deepEqual(
    idempotencyRecordFromDto(idempotencyRecordToDto(idempotency)),
    idempotency,
  );
});

test("persistence mappers reject unknown event kinds and functions", () => {
  const fixture = createPersistenceFixture();
  const event = fixture.history().events[0];
  assert.throws(
    () => conversationEventFromDto({
      schemaVersion: 1,
      eventType: "UnknownEvent",
      event: { ...event, type: "UnknownEvent" },
    }),
    PersistenceMappingFailure,
  );
  assert.throws(
    () => conversationEventFromDto({
      schemaVersion: 1,
      eventType: "ConversationStarted",
      event: {
        type: "ConversationStarted",
        eventVersion: 1,
        sequence: 1,
      },
    }),
    PersistenceMappingFailure,
  );
  assert.throws(
    () => outboxMessageToDto({
      ...fixture.outbox(event),
      payload: { execute: () => "forbidden" },
    }),
    PersistenceMappingFailure,
  );
});

test("outbox constructors reject function-valued payloads", () => {
  const fixture = createPersistenceFixture();
  const event = fixture.history().events[0];
  assert.throws(
    () => createOutboxMessage({
      ...fixture.outbox(event),
      payload: { handler: () => undefined },
    }),
    InvalidPersistenceValue,
  );
});
