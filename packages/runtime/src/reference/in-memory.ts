import {
  ForeignTransactionContext,
  HiddenNestedTransaction,
  PersistenceConcurrencyConflict,
  TenantScopeMismatch,
  createInMemoryConversationPersistence,
  type BeginTransactionInput,
  type ResultReference,
  type TenantId,
  type TransactionContext,
  type TransactionManager,
} from "@reviva/conversation";

import type {
  ExecutionRecord,
  ExecutionRecordRepository,
  HandoffRecord,
  HandoffRepository,
  RuntimePersistence,
  ToolResult,
} from "../contracts.js";
import type { RuntimeExecutionId } from "../identifiers.js";

type RuntimeReferenceState = {
  executionRecords: Map<string, ExecutionRecord>;
  results: Map<string, ToolResult>;
  handoffs: Map<string, HandoffRecord>;
};

const emptyState = (): RuntimeReferenceState => ({
  executionRecords: new Map(),
  results: new Map(),
  handoffs: new Map(),
});

const copyState = (state: RuntimeReferenceState): RuntimeReferenceState => ({
  executionRecords: new Map(state.executionRecords),
  results: new Map(state.results),
  handoffs: new Map(state.handoffs),
});

const key = (...parts: readonly string[]): string => JSON.stringify(parts);

class RuntimeReferenceStore {
  #state = emptyState();
  readonly #drafts = new WeakMap<TransactionContext, RuntimeReferenceState>();

  begin(context: TransactionContext): void {
    this.#drafts.set(context, copyState(this.#state));
  }

  draft(
    context: TransactionContext,
    tenantId: TenantId,
  ): RuntimeReferenceState {
    const draft = this.#drafts.get(context);
    if (draft === undefined || context.state !== "active") {
      throw new ForeignTransactionContext();
    }
    if (context.tenantId !== tenantId) {
      throw new TenantScopeMismatch();
    }
    return draft;
  }

  commit(context: TransactionContext): void {
    const draft = this.#drafts.get(context);
    if (draft === undefined) throw new ForeignTransactionContext();
    this.#state = draft;
    this.#drafts.delete(context);
  }

  rollback(context: TransactionContext): void {
    if (!this.#drafts.delete(context)) {
      throw new ForeignTransactionContext();
    }
  }
}

class CoordinatedReferenceTransactionManager implements TransactionManager {
  #active = false;

  constructor(
    private readonly base: TransactionManager,
    private readonly store: RuntimeReferenceStore,
  ) {}

  async begin(input: BeginTransactionInput): Promise<TransactionContext> {
    if (this.#active) throw new HiddenNestedTransaction();
    return this.start(input);
  }

  async commit(context: TransactionContext): Promise<void> {
    await this.base.commit(context);
    this.store.commit(context);
  }

  async rollback(context: TransactionContext): Promise<void> {
    await this.base.rollback(context);
    this.store.rollback(context);
  }

  async runInTransaction<T>(
    input: BeginTransactionInput,
    work: (context: TransactionContext) => Promise<T> | T,
  ): Promise<T> {
    if (this.#active) throw new HiddenNestedTransaction();
    const context = await this.start(input);
    this.#active = true;
    try {
      const result = await work(context);
      await this.base.commit(context);
      this.store.commit(context);
      return result;
    } catch (error) {
      if (context.state === "active") {
        await this.base.rollback(context);
        this.store.rollback(context);
      }
      throw error;
    } finally {
      this.#active = false;
    }
  }

  private async start(
    input: BeginTransactionInput,
  ): Promise<TransactionContext> {
    const context = await this.base.begin(input);
    this.store.begin(context);
    return context;
  }
}

class ReferenceExecutionRecordRepository
  implements ExecutionRecordRepository
{
  constructor(private readonly store: RuntimeReferenceStore) {}

  async get(
    context: TransactionContext,
    tenantId: TenantId,
    id: RuntimeExecutionId,
  ): Promise<ExecutionRecord | null> {
    return this.store.draft(context, tenantId).executionRecords.get(
      key(tenantId, id),
    ) ?? null;
  }

  async save(
    context: TransactionContext,
    record: ExecutionRecord,
    expectedRevision: number,
  ): Promise<void> {
    const draft = this.store.draft(context, record.tenantId);
    const recordKey = key(record.tenantId, record.id);
    const current = draft.executionRecords.get(recordKey);
    const currentRevision = current?.revision ?? -1;
    if (
      currentRevision !== expectedRevision ||
      record.revision <= currentRevision
    ) {
      throw new PersistenceConcurrencyConflict(
        "runtime_execution_record",
        expectedRevision,
        currentRevision,
      );
    }
    draft.executionRecords.set(recordKey, record);
  }

  async storeResult(
    context: TransactionContext,
    tenantId: TenantId,
    reference: ResultReference,
    result: ToolResult,
  ): Promise<void> {
    const draft = this.store.draft(context, tenantId);
    const resultKey = key(tenantId, reference);
    if (draft.results.has(resultKey)) {
      throw new PersistenceConcurrencyConflict(
        "runtime_execution_result",
        0,
        1,
      );
    }
    draft.results.set(resultKey, result);
  }

  async getResult(
    context: TransactionContext,
    tenantId: TenantId,
    reference: ResultReference,
  ): Promise<ToolResult | null> {
    return (
      this.store.draft(context, tenantId).results.get(
        key(tenantId, reference),
      ) ?? null
    );
  }
}

class ReferenceHandoffRepository implements HandoffRepository {
  constructor(private readonly store: RuntimeReferenceStore) {}

  async get(
    context: TransactionContext,
    tenantId: TenantId,
    id: HandoffRecord["id"],
  ): Promise<HandoffRecord | null> {
    return (
      this.store
        .draft(context, tenantId)
        .handoffs.get(key(tenantId, id)) ?? null
    );
  }

  async save(
    context: TransactionContext,
    record: HandoffRecord,
    expectedVersion: number,
  ): Promise<void> {
    const draft = this.store.draft(context, record.tenantId);
    const recordKey = key(record.tenantId, record.id);
    const current = draft.handoffs.get(recordKey);
    const currentVersion = current?.version ?? 0;
    if (
      currentVersion !== expectedVersion ||
      record.version !== expectedVersion + 1
    ) {
      throw new PersistenceConcurrencyConflict(
        "runtime_handoff",
        expectedVersion,
        currentVersion,
      );
    }
    draft.handoffs.set(recordKey, record);
  }
}

export type InMemoryRuntimePersistence = RuntimePersistence;

export const createInMemoryRuntimePersistence =
  (): InMemoryRuntimePersistence => {
    const base = createInMemoryConversationPersistence();
    const store = new RuntimeReferenceStore();
    return Object.freeze({
      ...base,
      transactionManager: new CoordinatedReferenceTransactionManager(
        base.transactionManager,
        store,
      ),
      executionRecords: new ReferenceExecutionRecordRepository(store),
      handoffs: new ReferenceHandoffRepository(store),
    });
  };
