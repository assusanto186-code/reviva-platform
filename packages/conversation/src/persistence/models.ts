import type { TenantId } from "@reviva/domain";

import type { Conversation } from "../aggregate/conversation.js";
import type { ConversationId, CorrelationId, CausationId } from "../identifiers/identifiers.js";
import { deepFreeze } from "../internal/immutable.js";
import type { ActorContext } from "../participants/participants.js";
import { InvalidPersistenceValue } from "./failures.js";
import {
  canonicalRequestFingerprint,
  type AuditEntryId,
  type CanonicalValue,
  type IdempotencyKey,
  type OperationId,
  type OutboxMessageId,
  type RequestFingerprint,
  type ResultReference,
} from "./values.js";

export type ConversationSnapshot = Readonly<{
  schemaVersion: 1;
  tenantId: TenantId;
  conversationId: ConversationId;
  aggregateVersion: number;
  projection: Conversation;
  integrityFingerprint: RequestFingerprint;
}>;

export type IdempotencyState = "processing" | "completed" | "failed";

export type IdempotencyRecord = Readonly<{
  tenantId: TenantId;
  actorReference: string;
  operationId: OperationId;
  key: IdempotencyKey;
  requestFingerprint: RequestFingerprint;
  state: IdempotencyState;
  reservedAt: string;
  completedAt: string | null;
  resultReference: ResultReference | null;
  failureCode: string | null;
}>;

export type IdempotencyReservation =
  | Readonly<{ kind: "reserved"; record: IdempotencyRecord }>
  | Readonly<{ kind: "in_progress"; record: IdempotencyRecord }>
  | Readonly<{ kind: "completed"; record: IdempotencyRecord }>
  | Readonly<{ kind: "failed"; record: IdempotencyRecord }>;

export const outboxStates = [
  "Pending",
  "Processing",
  "Published",
  "Failed",
] as const;
export type OutboxState = (typeof outboxStates)[number];

export type OutboxMessage = Readonly<{
  id: OutboxMessageId;
  tenantId: TenantId;
  aggregateId: ConversationId | null;
  messageType: string;
  schemaVersion: number;
  payload: CanonicalValue;
  occurredAt: string;
  availableAt: string;
  correlationId: CorrelationId;
  causationId: CausationId | null;
  orderingKey: string;
  orderingSequence: number;
  attemptCount: number;
  state: OutboxState;
  claimedAt: string | null;
  publishedAt: string | null;
  failureCode: string | null;
}>;

export type SafeAuditMetadataValue = string | number | boolean | null;

export type AuditEntry = Readonly<{
  id: AuditEntryId;
  tenantId: TenantId;
  actor: ActorContext;
  aggregateType: "conversation";
  aggregateId: ConversationId;
  action: string;
  aggregateVersion: number;
  correlationId: CorrelationId;
  occurredAt: string;
  metadata: Readonly<Record<string, SafeAuditMetadataValue>>;
}>;

const isoTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const safeNamePattern = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/u;
const sensitiveMetadataKey =
  /(?:password|passcode|secret|token|authorization|cookie|connection|credential|private.?key)/iu;
const sensitiveMetadataValue =
  /(?:postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._-]+|eyJ[a-z0-9_-]{16,}\.|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu;

export const assertIsoTimestamp = (value: string, name: string): void => {
  if (!isoTimestampPattern.test(value)) {
    throw new InvalidPersistenceValue(name, "not_an_utc_iso_timestamp");
  }
};

export const assertSafeReference = (value: string, name: string): void => {
  if (!safeNamePattern.test(value)) {
    throw new InvalidPersistenceValue(name, "invalid_safe_reference");
  }
};

export const assertPositiveVersion = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new InvalidPersistenceValue(name, "not_a_positive_safe_integer");
  }
};

const snapshotFingerprint = (projection: Conversation): RequestFingerprint =>
  canonicalRequestFingerprint(projection as unknown as CanonicalValue);

export const createConversationSnapshot = (
  projection: Conversation,
): ConversationSnapshot =>
  deepFreeze({
    schemaVersion: 1,
    tenantId: projection.tenantId,
    conversationId: projection.id,
    aggregateVersion: projection.version,
    projection,
    integrityFingerprint: snapshotFingerprint(projection),
  });

export const hasValidSnapshotIntegrity = (
  snapshot: ConversationSnapshot,
): boolean =>
  snapshot.integrityFingerprint === snapshotFingerprint(snapshot.projection);

export type CreateOutboxMessageInput = Readonly<
  Omit<
    OutboxMessage,
    | "attemptCount"
    | "state"
    | "claimedAt"
    | "publishedAt"
    | "failureCode"
  >
>;

export const createOutboxMessage = (
  input: CreateOutboxMessageInput,
): OutboxMessage => {
  assertSafeReference(input.messageType, "OutboxMessage.messageType");
  assertPositiveVersion(input.schemaVersion, "OutboxMessage.schemaVersion");
  assertIsoTimestamp(input.occurredAt, "OutboxMessage.occurredAt");
  assertIsoTimestamp(input.availableAt, "OutboxMessage.availableAt");
  assertSafeReference(input.orderingKey, "OutboxMessage.orderingKey");
  if (!Number.isSafeInteger(input.orderingSequence) || input.orderingSequence < 0) {
    throw new InvalidPersistenceValue(
      "OutboxMessage.orderingSequence",
      "not_a_nonnegative_safe_integer",
    );
  }
  canonicalRequestFingerprint(input.payload);
  return deepFreeze({
    ...input,
    attemptCount: 0,
    state: "Pending" as const,
    claimedAt: null,
    publishedAt: null,
    failureCode: null,
  });
};

export type CreateAuditEntryInput = Readonly<AuditEntry>;

export const createAuditEntry = (
  input: CreateAuditEntryInput,
): AuditEntry => {
  if (input.actor.tenantId !== input.tenantId) {
    throw new InvalidPersistenceValue("AuditEntry.actor", "tenant_mismatch");
  }
  assertSafeReference(input.action, "AuditEntry.action");
  assertPositiveVersion(input.aggregateVersion, "AuditEntry.aggregateVersion");
  assertIsoTimestamp(input.occurredAt, "AuditEntry.occurredAt");
  for (const [key, value] of Object.entries(input.metadata)) {
    if (!safeNamePattern.test(key) || sensitiveMetadataKey.test(key)) {
      throw new InvalidPersistenceValue("AuditEntry.metadata", "unsafe_metadata_key");
    }
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new InvalidPersistenceValue("AuditEntry.metadata", "unsafe_metadata_value");
    }
    if (
      typeof value === "string" &&
      (value.length > 256 || sensitiveMetadataValue.test(value))
    ) {
      throw new InvalidPersistenceValue("AuditEntry.metadata", "sensitive_metadata_value");
    }
  }
  return deepFreeze({
    ...input,
    metadata: { ...input.metadata },
  });
};
