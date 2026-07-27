import type { TenantId } from "@reviva/domain";

import type { Conversation } from "../aggregate/conversation.js";
import type { ConversationEvent } from "../events/events.js";
import type { ConversationId } from "../identifiers/identifiers.js";
import { rehydrateConversation } from "../rehydration/rehydrate.js";
import type {
  AuditRepository,
  BeginTransactionInput,
  ConversationEventRepository,
  ConversationEventStream,
  ConversationProjectionRepository,
  ConversationProjectionResult,
  ConversationSnapshotRepository,
  ConversationSnapshotResult,
  IdempotencyRepository,
  OutboxRepository,
  ReserveIdempotencyInput,
  TransactionContext,
  TransactionManager,
  TransactionState,
} from "./contracts.js";
import {
  ConversationStreamNotFound,
  DuplicatePersistenceIdentifier,
  ForeignTransactionContext,
  HiddenNestedTransaction,
  IdempotencyPayloadMismatch,
  InvalidIdempotencyTransition,
  InvalidOutboxTransition,
  InvalidPersistenceValue,
  PersistenceConcurrencyConflict,
  SnapshotIncompatible,
  TenantScopeMismatch,
  TransactionClosed,
} from "./failures.js";
import {
  assertIsoTimestamp,
  assertPositiveVersion,
  assertSafeReference,
  hasValidSnapshotIntegrity,
  type AuditEntry,
  type ConversationSnapshot,
  type IdempotencyRecord,
  type IdempotencyReservation,
  type OutboxMessage,
} from "./models.js";
import type {
  ExpectedVersion,
  IdempotencyKey,
  OperationId,
  OutboxMessageId,
  RequestFingerprint,
  ResultReference,
} from "./values.js";

type ReferenceState = {
  eventStreams: Map<string, readonly ConversationEvent[]>;
  projections: Map<string, Conversation>;
  snapshots: Map<string, ConversationSnapshot>;
  idempotency: Map<string, IdempotencyRecord>;
  outbox: Map<string, OutboxMessage>;
  audit: Map<string, AuditEntry>;
};

const emptyState = (): ReferenceState => ({
  eventStreams: new Map(),
  projections: new Map(),
  snapshots: new Map(),
  idempotency: new Map(),
  outbox: new Map(),
  audit: new Map(),
});

const copyState = (state: ReferenceState): ReferenceState => ({
  eventStreams: new Map(state.eventStreams),
  projections: new Map(state.projections),
  snapshots: new Map(state.snapshots),
  idempotency: new Map(state.idempotency),
  outbox: new Map(state.outbox),
  audit: new Map(state.audit),
});

const scopedKey = (...parts: readonly string[]): string =>
  JSON.stringify(parts);

const eventKey = (tenantId: TenantId, conversationId: ConversationId): string =>
  scopedKey(tenantId, conversationId);

const idempotencyRecordKey = (
  tenantId: TenantId,
  actorReference: string,
  operation: OperationId,
  key: IdempotencyKey,
): string => scopedKey(tenantId, actorReference, operation, key);

const outboxKey = (tenantId: TenantId, id: OutboxMessageId): string =>
  scopedKey(tenantId, id);

const auditKey = (tenantId: TenantId, id: string): string =>
  scopedKey(tenantId, id);

class ReferenceTransaction implements TransactionContext {
  readonly baseRevision: number;
  readonly draft: ReferenceState;
  #state: TransactionState = "active";

  constructor(
    readonly owner: InMemoryReferenceStore,
    readonly id: BeginTransactionInput["id"],
    readonly tenantId: TenantId,
    baseRevision: number,
    state: ReferenceState,
  ) {
    this.baseRevision = baseRevision;
    this.draft = copyState(state);
  }

  get state(): TransactionState {
    return this.#state;
  }

  assertActive(): void {
    if (this.#state !== "active") {
      throw new TransactionClosed(this.#state);
    }
  }

  close(state: Exclude<TransactionState, "active">): void {
    this.assertActive();
    this.#state = state;
  }
}

const ensureScope = (
  transaction: ReferenceTransaction,
  tenantId: TenantId,
): void => {
  transaction.assertActive();
  if (transaction.tenantId !== tenantId) {
    throw new TenantScopeMismatch();
  }
};

class ReferenceTransactionManager implements TransactionManager {
  #coordinatedTransactionActive = false;

  constructor(private readonly store: InMemoryReferenceStore) {}

  async begin(input: BeginTransactionInput): Promise<TransactionContext> {
    if (this.#coordinatedTransactionActive) {
      throw new HiddenNestedTransaction();
    }
    return this.store.begin(input);
  }

  async commit(context: TransactionContext): Promise<void> {
    this.store.commit(context);
  }

  async rollback(context: TransactionContext): Promise<void> {
    this.store.rollback(context);
  }

  async runInTransaction<T>(
    input: BeginTransactionInput,
    work: (context: TransactionContext) => Promise<T> | T,
  ): Promise<T> {
    if (this.#coordinatedTransactionActive) {
      throw new HiddenNestedTransaction();
    }
    const context = this.store.begin(input);
    this.#coordinatedTransactionActive = true;
    try {
      const result = await work(context);
      this.store.commit(context);
      return result;
    } catch (error) {
      if (context.state === "active") {
        this.store.rollback(context);
      }
      throw error;
    } finally {
      this.#coordinatedTransactionActive = false;
    }
  }
}

class ReferenceEventRepository implements ConversationEventRepository {
  constructor(private readonly store: InMemoryReferenceStore) {}

  async load(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
    afterVersion = 0,
  ): Promise<ConversationEventStream> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    if (!Number.isSafeInteger(afterVersion) || afterVersion < 0) {
      throw new InvalidPersistenceValue(
        "ConversationEventRepository.afterVersion",
        "not_a_nonnegative_safe_integer",
      );
    }
    const events = transaction.draft.eventStreams.get(
      eventKey(tenantId, conversationId),
    );
    if (events === undefined) {
      return Object.freeze({
        found: false,
        events: Object.freeze([]) as readonly [],
      });
    }
    if (afterVersion > events.length) {
      throw new PersistenceConcurrencyConflict(
        "conversation_event_stream",
        afterVersion,
        events.length,
      );
    }
    return Object.freeze({
      found: true,
      version: events.length,
      events: Object.freeze(events.slice(afterVersion)),
    });
  }

  async append(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
    expectedVersion: ExpectedVersion,
    events: readonly ConversationEvent[],
  ): Promise<number> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    if (events.length === 0) {
      throw new InvalidPersistenceValue(
        "ConversationEventRepository.events",
        "empty_append",
      );
    }
    const key = eventKey(tenantId, conversationId);
    const current = transaction.draft.eventStreams.get(key) ?? [];
    if (current.length !== expectedVersion) {
      throw new PersistenceConcurrencyConflict(
        "conversation_event_stream",
        expectedVersion,
        current.length,
      );
    }
    const knownIds = new Set(current.map((event) => event.eventId as string));
    const appended: ConversationEvent[] = [];
    for (const [index, event] of events.entries()) {
      const expectedSequence = current.length + index + 1;
      if (
        event.tenantId !== tenantId ||
        event.conversationId !== conversationId
      ) {
        throw new TenantScopeMismatch();
      }
      if (event.eventVersion !== 1 || event.sequence !== expectedSequence) {
        throw new InvalidPersistenceValue(
          "ConversationEventRepository.events",
          "noncontiguous_or_unsupported_event",
        );
      }
      if (knownIds.has(event.eventId)) {
        throw new DuplicatePersistenceIdentifier("conversation event");
      }
      knownIds.add(event.eventId);
      appended.push(event);
    }
    const next = Object.freeze([...current, ...appended]);
    transaction.draft.eventStreams.set(key, next);
    return next.length;
  }
}

class ReferenceProjectionRepository
  implements ConversationProjectionRepository
{
  constructor(private readonly store: InMemoryReferenceStore) {}

  async get(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
  ): Promise<ConversationProjectionResult> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    const projection = transaction.draft.projections.get(
      eventKey(tenantId, conversationId),
    );
    return projection === undefined
      ? Object.freeze({ found: false, projection: null })
      : Object.freeze({ found: true, projection });
  }

  async save(
    context: TransactionContext,
    projection: Conversation,
    expectedVersion: ExpectedVersion,
  ): Promise<void> {
    const transaction = this.store.context(context);
    ensureScope(transaction, projection.tenantId);
    const key = eventKey(projection.tenantId, projection.id);
    const currentVersion =
      transaction.draft.projections.get(key)?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new PersistenceConcurrencyConflict(
        "conversation_projection",
        expectedVersion,
        currentVersion,
      );
    }
    const streamVersion =
      transaction.draft.eventStreams.get(key)?.length ?? 0;
    if (projection.version !== streamVersion || projection.version < 1) {
      throw new PersistenceConcurrencyConflict(
        "conversation_projection_event_stream",
        projection.version,
        streamVersion,
      );
    }
    transaction.draft.projections.set(key, projection);
  }

  async rebuild(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
  ): Promise<Conversation> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    const key = eventKey(tenantId, conversationId);
    const events = transaction.draft.eventStreams.get(key);
    if (events === undefined) {
      throw new ConversationStreamNotFound();
    }
    const rebuilt = rehydrateConversation(events);
    if (!rebuilt.ok) {
      throw new InvalidPersistenceValue(
        "ConversationProjectionRepository.rebuild",
        rebuilt.failure.code,
      );
    }
    transaction.draft.projections.set(key, rebuilt.value);
    return rebuilt.value;
  }
}

class ReferenceSnapshotRepository implements ConversationSnapshotRepository {
  constructor(private readonly store: InMemoryReferenceStore) {}

  async get(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
  ): Promise<ConversationSnapshotResult> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    const snapshot = transaction.draft.snapshots.get(
      eventKey(tenantId, conversationId),
    );
    return snapshot === undefined
      ? Object.freeze({ found: false, snapshot: null })
      : Object.freeze({ found: true, snapshot });
  }

  async save(
    context: TransactionContext,
    snapshot: ConversationSnapshot,
    expectedSnapshotVersion: ExpectedVersion,
  ): Promise<void> {
    const transaction = this.store.context(context);
    ensureScope(transaction, snapshot.tenantId);
    const key = eventKey(snapshot.tenantId, snapshot.conversationId);
    const currentVersion =
      transaction.draft.snapshots.get(key)?.aggregateVersion ?? 0;
    if (currentVersion !== expectedSnapshotVersion) {
      throw new PersistenceConcurrencyConflict(
        "conversation_snapshot",
        expectedSnapshotVersion,
        currentVersion,
      );
    }
    const streamVersion =
      transaction.draft.eventStreams.get(key)?.length ?? 0;
    if (snapshot.schemaVersion !== 1) {
      throw new SnapshotIncompatible("unsupported_schema_version");
    }
    if (
      snapshot.projection.id !== snapshot.conversationId ||
      snapshot.projection.tenantId !== snapshot.tenantId ||
      snapshot.projection.version !== snapshot.aggregateVersion
    ) {
      throw new SnapshotIncompatible(
        "projection_identity_or_version_mismatch",
      );
    }
    if (snapshot.aggregateVersion > streamVersion) {
      throw new SnapshotIncompatible("snapshot_ahead_of_stream");
    }
    if (snapshot.aggregateVersion < currentVersion) {
      throw new PersistenceConcurrencyConflict(
        "conversation_snapshot",
        currentVersion,
        snapshot.aggregateVersion,
      );
    }
    if (!hasValidSnapshotIntegrity(snapshot)) {
      throw new SnapshotIncompatible("integrity_mismatch");
    }
    transaction.draft.snapshots.set(key, snapshot);
  }
}

type IdempotencyTransitionInput = Readonly<{
  tenantId: TenantId;
  actorReference: string;
  operationId: OperationId;
  key: IdempotencyKey;
  requestFingerprint: RequestFingerprint;
  completedAt: string;
}>;

class ReferenceIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly store: InMemoryReferenceStore) {}

  async reserve(
    context: TransactionContext,
    input: ReserveIdempotencyInput,
  ): Promise<IdempotencyReservation> {
    const transaction = this.store.context(context);
    ensureScope(transaction, input.tenantId);
    assertSafeReference(input.actorReference, "Idempotency.actorReference");
    assertIsoTimestamp(input.reservedAt, "Idempotency.reservedAt");
    const key = idempotencyRecordKey(
      input.tenantId,
      input.actorReference,
      input.operationId,
      input.key,
    );
    const existing = transaction.draft.idempotency.get(key);
    if (existing !== undefined) {
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new IdempotencyPayloadMismatch();
      }
      if (existing.state === "processing") {
        return Object.freeze({ kind: "in_progress", record: existing });
      }
      if (existing.state === "completed") {
        return Object.freeze({ kind: "completed", record: existing });
      }
      return Object.freeze({ kind: "failed", record: existing });
    }
    const created = Object.freeze({
      ...input,
      state: "processing" as const,
      completedAt: null,
      resultReference: null,
      failureCode: null,
    });
    transaction.draft.idempotency.set(key, created);
    return Object.freeze({ kind: "reserved", record: created });
  }

  async complete(
    context: TransactionContext,
    input: IdempotencyTransitionInput &
      Readonly<{ resultReference: ResultReference }>,
  ): Promise<IdempotencyRecord> {
    return this.transition(context, input, "completed");
  }

  async fail(
    context: TransactionContext,
    input: IdempotencyTransitionInput & Readonly<{ failureCode: string }>,
  ): Promise<IdempotencyRecord> {
    assertSafeReference(input.failureCode, "Idempotency.failureCode");
    return this.transition(context, input, "failed");
  }

  async get(
    context: TransactionContext,
    input: Readonly<{
      tenantId: TenantId;
      actorReference: string;
      operationId: OperationId;
      key: IdempotencyKey;
    }>,
  ): Promise<IdempotencyRecord | null> {
    const transaction = this.store.context(context);
    ensureScope(transaction, input.tenantId);
    return (
      transaction.draft.idempotency.get(
        idempotencyRecordKey(
          input.tenantId,
          input.actorReference,
          input.operationId,
          input.key,
        ),
      ) ?? null
    );
  }

  private transition(
    context: TransactionContext,
    input: IdempotencyTransitionInput &
      Readonly<{
        resultReference?: ResultReference;
        failureCode?: string;
      }>,
    state: "completed" | "failed",
  ): IdempotencyRecord {
    const transaction = this.store.context(context);
    ensureScope(transaction, input.tenantId);
    assertIsoTimestamp(input.completedAt, "Idempotency.completedAt");
    const key = idempotencyRecordKey(
      input.tenantId,
      input.actorReference,
      input.operationId,
      input.key,
    );
    const existing = transaction.draft.idempotency.get(key);
    if (existing === undefined || existing.state !== "processing") {
      throw new InvalidIdempotencyTransition("record_not_processing");
    }
    if (existing.requestFingerprint !== input.requestFingerprint) {
      throw new IdempotencyPayloadMismatch();
    }
    const next = Object.freeze({
      ...existing,
      state,
      completedAt: input.completedAt,
      resultReference:
        state === "completed" ? input.resultReference ?? null : null,
      failureCode: state === "failed" ? input.failureCode ?? null : null,
    });
    if (
      (state === "completed" && next.resultReference === null) ||
      (state === "failed" && next.failureCode === null)
    ) {
      throw new InvalidIdempotencyTransition("missing_transition_outcome");
    }
    transaction.draft.idempotency.set(key, next);
    return next;
  }
}

class ReferenceOutboxRepository implements OutboxRepository {
  constructor(private readonly store: InMemoryReferenceStore) {}

  async enqueue(
    context: TransactionContext,
    message: OutboxMessage,
  ): Promise<void> {
    const transaction = this.store.context(context);
    ensureScope(transaction, message.tenantId);
    if (message.state !== "Pending" || message.attemptCount !== 0) {
      throw new InvalidOutboxTransition(message.state, "Pending");
    }
    const key = outboxKey(message.tenantId, message.id);
    if (transaction.draft.outbox.has(key)) {
      throw new DuplicatePersistenceIdentifier("outbox message");
    }
    transaction.draft.outbox.set(key, message);
  }

  async fetchEligible(
    context: TransactionContext,
    tenantId: TenantId,
    availableAt: string,
    limit: number,
  ): Promise<readonly OutboxMessage[]> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    assertIsoTimestamp(availableAt, "Outbox.fetchEligible.availableAt");
    assertPositiveVersion(limit, "Outbox.fetchEligible.limit");
    return Object.freeze(
      [...transaction.draft.outbox.values()]
        .filter(
          (message) =>
            message.tenantId === tenantId &&
            (message.state === "Pending" || message.state === "Failed") &&
            message.availableAt <= availableAt,
        )
        .sort(
          (left, right) =>
            left.availableAt.localeCompare(right.availableAt) ||
            left.orderingKey.localeCompare(right.orderingKey) ||
            left.orderingSequence - right.orderingSequence ||
            left.id.localeCompare(right.id),
        )
        .slice(0, limit),
    );
  }

  async claim(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
    claimedAt: string,
  ): Promise<OutboxMessage> {
    assertIsoTimestamp(claimedAt, "Outbox.claimedAt");
    return this.transition(context, tenantId, id, (current) => {
      if (current.state !== "Pending" && current.state !== "Failed") {
        throw new InvalidOutboxTransition(current.state, "Processing");
      }
      if (current.availableAt > claimedAt) {
        throw new InvalidOutboxTransition(current.state, "Processing");
      }
      return Object.freeze({
        ...current,
        state: "Processing" as const,
        attemptCount: current.attemptCount + 1,
        claimedAt,
        failureCode: null,
      });
    });
  }

  async markPublished(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
    publishedAt: string,
  ): Promise<OutboxMessage> {
    assertIsoTimestamp(publishedAt, "Outbox.publishedAt");
    return this.transition(context, tenantId, id, (current) => {
      if (current.state !== "Processing") {
        throw new InvalidOutboxTransition(current.state, "Published");
      }
      return Object.freeze({
        ...current,
        state: "Published" as const,
        publishedAt,
      });
    });
  }

  async recordFailure(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
    failureCode: string,
    nextAvailableAt: string,
  ): Promise<OutboxMessage> {
    assertSafeReference(failureCode, "Outbox.failureCode");
    assertIsoTimestamp(nextAvailableAt, "Outbox.nextAvailableAt");
    return this.transition(context, tenantId, id, (current) => {
      if (current.state !== "Processing") {
        throw new InvalidOutboxTransition(current.state, "Failed");
      }
      return Object.freeze({
        ...current,
        state: "Failed" as const,
        claimedAt: null,
        failureCode,
        availableAt: nextAvailableAt,
      });
    });
  }

  async get(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
  ): Promise<OutboxMessage | null> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    return transaction.draft.outbox.get(outboxKey(tenantId, id)) ?? null;
  }

  private transition(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
    update: (current: OutboxMessage) => OutboxMessage,
  ): OutboxMessage {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    const key = outboxKey(tenantId, id);
    const current = transaction.draft.outbox.get(key);
    if (current === undefined) {
      throw new InvalidPersistenceValue("OutboxMessage", "not_found");
    }
    const next = update(current);
    transaction.draft.outbox.set(key, next);
    return next;
  }
}

class ReferenceAuditRepository implements AuditRepository {
  constructor(private readonly store: InMemoryReferenceStore) {}

  async append(
    context: TransactionContext,
    entry: AuditEntry,
  ): Promise<void> {
    const transaction = this.store.context(context);
    ensureScope(transaction, entry.tenantId);
    const key = auditKey(entry.tenantId, entry.id);
    if (transaction.draft.audit.has(key)) {
      throw new DuplicatePersistenceIdentifier("audit entry");
    }
    transaction.draft.audit.set(key, entry);
  }

  async listForAggregate(
    context: TransactionContext,
    tenantId: TenantId,
    aggregateId: ConversationId,
  ): Promise<readonly AuditEntry[]> {
    const transaction = this.store.context(context);
    ensureScope(transaction, tenantId);
    return Object.freeze(
      [...transaction.draft.audit.values()]
        .filter(
          (entry) =>
            entry.tenantId === tenantId &&
            entry.aggregateId === aggregateId,
        )
        .sort(
          (left, right) =>
            left.occurredAt.localeCompare(right.occurredAt) ||
            left.id.localeCompare(right.id),
        ),
    );
  }
}

class InMemoryReferenceStore {
  #state = emptyState();
  #revision = 0;

  readonly transactionManager: TransactionManager;
  readonly events: ConversationEventRepository;
  readonly projections: ConversationProjectionRepository;
  readonly snapshots: ConversationSnapshotRepository;
  readonly idempotency: IdempotencyRepository;
  readonly outbox: OutboxRepository;
  readonly audit: AuditRepository;

  constructor() {
    this.transactionManager = new ReferenceTransactionManager(this);
    this.events = new ReferenceEventRepository(this);
    this.projections = new ReferenceProjectionRepository(this);
    this.snapshots = new ReferenceSnapshotRepository(this);
    this.idempotency = new ReferenceIdempotencyRepository(this);
    this.outbox = new ReferenceOutboxRepository(this);
    this.audit = new ReferenceAuditRepository(this);
  }

  begin(input: BeginTransactionInput): ReferenceTransaction {
    return new ReferenceTransaction(
      this,
      input.id,
      input.tenantId,
      this.#revision,
      this.#state,
    );
  }

  context(context: TransactionContext): ReferenceTransaction {
    if (
      !(context instanceof ReferenceTransaction) ||
      context.owner !== this
    ) {
      throw new ForeignTransactionContext();
    }
    context.assertActive();
    return context;
  }

  commit(context: TransactionContext): void {
    const transaction = this.context(context);
    if (transaction.baseRevision !== this.#revision) {
      transaction.close("rolled_back");
      throw new PersistenceConcurrencyConflict(
        "reference_transaction_store",
        transaction.baseRevision,
        this.#revision,
      );
    }
    this.#state = transaction.draft;
    this.#revision += 1;
    transaction.close("committed");
  }

  rollback(context: TransactionContext): void {
    this.context(context).close("rolled_back");
  }
}

export type InMemoryConversationPersistence = Readonly<{
  transactionManager: TransactionManager;
  events: ConversationEventRepository;
  projections: ConversationProjectionRepository;
  snapshots: ConversationSnapshotRepository;
  idempotency: IdempotencyRepository;
  outbox: OutboxRepository;
  audit: AuditRepository;
}>;

export const createInMemoryConversationPersistence =
  (): InMemoryConversationPersistence => {
    const store = new InMemoryReferenceStore();
    return Object.freeze({
      transactionManager: store.transactionManager,
      events: store.events,
      projections: store.projections,
      snapshots: store.snapshots,
      idempotency: store.idempotency,
      outbox: store.outbox,
      audit: store.audit,
    });
  };
