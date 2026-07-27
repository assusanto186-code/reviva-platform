import type { TenantId } from "@reviva/domain";

import type { Conversation } from "../aggregate/conversation.js";
import type { ConversationEvent } from "../events/events.js";
import type { ConversationId } from "../identifiers/identifiers.js";
import type {
  AuditEntry,
  ConversationSnapshot,
  IdempotencyRecord,
  IdempotencyReservation,
  OutboxMessage,
} from "./models.js";
import type {
  ExpectedVersion,
  IdempotencyKey,
  OperationId,
  OutboxMessageId,
  RequestFingerprint,
  ResultReference,
  TransactionId,
} from "./values.js";

export type TransactionState = "active" | "committed" | "rolled_back";

export interface TransactionContext {
  readonly id: TransactionId;
  readonly tenantId: TenantId;
  readonly state: TransactionState;
}

export type BeginTransactionInput = Readonly<{
  id: TransactionId;
  tenantId: TenantId;
}>;

export interface TransactionManager {
  begin(input: BeginTransactionInput): Promise<TransactionContext>;
  commit(context: TransactionContext): Promise<void>;
  rollback(context: TransactionContext): Promise<void>;
  runInTransaction<T>(
    input: BeginTransactionInput,
    work: (context: TransactionContext) => Promise<T> | T,
  ): Promise<T>;
}

export type ConversationEventStream =
  | Readonly<{ found: false; events: readonly [] }>
  | Readonly<{
      found: true;
      version: number;
      events: readonly ConversationEvent[];
    }>;

export interface ConversationEventRepository {
  load(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
    afterVersion?: number,
  ): Promise<ConversationEventStream>;
  append(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
    expectedVersion: ExpectedVersion,
    events: readonly ConversationEvent[],
  ): Promise<number>;
}

export type ConversationProjectionResult =
  | Readonly<{ found: false; projection: null }>
  | Readonly<{ found: true; projection: Conversation }>;

export interface ConversationProjectionRepository {
  get(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
  ): Promise<ConversationProjectionResult>;
  save(
    context: TransactionContext,
    projection: Conversation,
    expectedVersion: ExpectedVersion,
  ): Promise<void>;
  rebuild(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
  ): Promise<Conversation>;
}

export type ConversationSnapshotResult =
  | Readonly<{ found: false; snapshot: null }>
  | Readonly<{ found: true; snapshot: ConversationSnapshot }>;

export interface ConversationSnapshotRepository {
  get(
    context: TransactionContext,
    tenantId: TenantId,
    conversationId: ConversationId,
  ): Promise<ConversationSnapshotResult>;
  save(
    context: TransactionContext,
    snapshot: ConversationSnapshot,
    expectedSnapshotVersion: ExpectedVersion,
  ): Promise<void>;
}

export type ReserveIdempotencyInput = Readonly<{
  tenantId: TenantId;
  actorReference: string;
  operationId: OperationId;
  key: IdempotencyKey;
  requestFingerprint: RequestFingerprint;
  reservedAt: string;
}>;

export interface IdempotencyRepository {
  reserve(
    context: TransactionContext,
    input: ReserveIdempotencyInput,
  ): Promise<IdempotencyReservation>;
  complete(
    context: TransactionContext,
    input: Readonly<{
      tenantId: TenantId;
      actorReference: string;
      operationId: OperationId;
      key: IdempotencyKey;
      requestFingerprint: RequestFingerprint;
      resultReference: ResultReference;
      completedAt: string;
    }>,
  ): Promise<IdempotencyRecord>;
  fail(
    context: TransactionContext,
    input: Readonly<{
      tenantId: TenantId;
      actorReference: string;
      operationId: OperationId;
      key: IdempotencyKey;
      requestFingerprint: RequestFingerprint;
      failureCode: string;
      completedAt: string;
    }>,
  ): Promise<IdempotencyRecord>;
  get(
    context: TransactionContext,
    input: Readonly<{
      tenantId: TenantId;
      actorReference: string;
      operationId: OperationId;
      key: IdempotencyKey;
    }>,
  ): Promise<IdempotencyRecord | null>;
}

export interface OutboxRepository {
  enqueue(
    context: TransactionContext,
    message: OutboxMessage,
  ): Promise<void>;
  fetchEligible(
    context: TransactionContext,
    tenantId: TenantId,
    availableAt: string,
    limit: number,
  ): Promise<readonly OutboxMessage[]>;
  claim(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
    claimedAt: string,
  ): Promise<OutboxMessage>;
  markPublished(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
    publishedAt: string,
  ): Promise<OutboxMessage>;
  recordFailure(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
    failureCode: string,
    nextAvailableAt: string,
  ): Promise<OutboxMessage>;
  get(
    context: TransactionContext,
    tenantId: TenantId,
    id: OutboxMessageId,
  ): Promise<OutboxMessage | null>;
}

export interface AuditRepository {
  append(context: TransactionContext, entry: AuditEntry): Promise<void>;
  listForAggregate(
    context: TransactionContext,
    tenantId: TenantId,
    aggregateId: ConversationId,
  ): Promise<readonly AuditEntry[]>;
}
