import type { ConversationEvent } from "../events/events.js";
import { deepFreeze } from "../internal/immutable.js";
import { PersistenceMappingFailure } from "./failures.js";
import type {
  ConversationSnapshot,
  IdempotencyRecord,
  OutboxMessage,
} from "./models.js";

export type ConversationEventDto = Readonly<{
  schemaVersion: 1;
  eventType: ConversationEvent["type"];
  event: ConversationEvent;
}>;

export type ConversationSnapshotDto = Readonly<{
  schemaVersion: 1;
  snapshot: ConversationSnapshot;
}>;

export type OutboxMessageDto = Readonly<{
  schemaVersion: 1;
  message: OutboxMessage;
}>;

export type IdempotencyRecordDto = Readonly<{
  schemaVersion: 1;
  record: IdempotencyRecord;
}>;

const eventTypes: ReadonlySet<string> = new Set([
  "ConversationStarted",
  "InboundMessageRecorded",
  "OutboundMessageRecorded",
  "ConversationAwaitingUser",
  "ToolActionProposed",
  "ConfirmationRequested",
  "PatientConfirmed",
  "PatientConfirmationRejected",
  "ToolExecutionScheduled",
  "ToolExecutionSucceeded",
  "ToolExecutionFailed",
  "HumanHandoffRequested",
  "HumanHandoffAccepted",
  "HumanHandoffResolved",
  "AutomationResumed",
  "ConversationAssigned",
  "BookingIntentRecorded",
  "BookingProgressUpdated",
  "ReactivationResponseRecorded",
  "ConversationResolved",
  "ConversationClosed",
  "ConversationReopened",
  "ConversationFailed",
  "ConversationRecovered",
]);

const record = (value: unknown): Record<string, unknown> => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new PersistenceMappingFailure("expected_plain_object");
  }
  return value as Record<string, unknown>;
};

const rejectFunctions = (value: unknown, seen = new Set<object>()): void => {
  if (typeof value === "function") {
    throw new PersistenceMappingFailure("function_values_are_forbidden");
  }
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    rejectFunctions(nested, seen);
  }
};

const copy = <T>(value: T): T => {
  rejectFunctions(value);
  try {
    return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
  } catch {
    throw new PersistenceMappingFailure("value_is_not_serializable");
  }
};

const envelope = (
  value: unknown,
  expectedField: string,
): Record<string, unknown> => {
  const dto = record(value);
  if (dto.schemaVersion !== 1 || !(expectedField in dto)) {
    throw new PersistenceMappingFailure("unsupported_schema_or_missing_payload");
  }
  return dto;
};

const stringFields = (
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean => fields.every((field) => typeof value[field] === "string");

export const conversationEventToDto = (
  event: ConversationEvent,
): ConversationEventDto =>
  deepFreeze({
    schemaVersion: 1,
    eventType: event.type,
    event: copy(event),
  });

export const conversationEventFromDto = (
  value: unknown,
): ConversationEvent => {
  const dto = envelope(value, "event");
  const event = record(dto.event);
  if (
    typeof dto.eventType !== "string" ||
    !eventTypes.has(dto.eventType) ||
    event.type !== dto.eventType ||
    event.eventVersion !== 1 ||
    !stringFields(event, [
      "eventId",
      "commandId",
      "conversationId",
      "tenantId",
      "occurredAt",
      "correlationId",
    ]) ||
    event.actor === null ||
    typeof event.actor !== "object" ||
    event.payload === null ||
    typeof event.payload !== "object" ||
    !Number.isSafeInteger(event.sequence) ||
    (event.sequence as number) < 1
  ) {
    throw new PersistenceMappingFailure("unsupported_or_invalid_event");
  }
  return copy(event) as unknown as ConversationEvent;
};

export const conversationSnapshotToDto = (
  snapshot: ConversationSnapshot,
): ConversationSnapshotDto =>
  deepFreeze({ schemaVersion: 1, snapshot: copy(snapshot) });

export const conversationSnapshotFromDto = (
  value: unknown,
): ConversationSnapshot => {
  const dto = envelope(value, "snapshot");
  const snapshot = record(dto.snapshot);
  if (
    snapshot.schemaVersion !== 1 ||
    !stringFields(snapshot, [
      "tenantId",
      "conversationId",
      "integrityFingerprint",
    ]) ||
    snapshot.projection === null ||
    typeof snapshot.projection !== "object" ||
    !Number.isSafeInteger(snapshot.aggregateVersion) ||
    (snapshot.aggregateVersion as number) < 1
  ) {
    throw new PersistenceMappingFailure("unsupported_or_invalid_snapshot");
  }
  return copy(snapshot) as unknown as ConversationSnapshot;
};

export const outboxMessageToDto = (
  message: OutboxMessage,
): OutboxMessageDto =>
  deepFreeze({ schemaVersion: 1, message: copy(message) });

export const outboxMessageFromDto = (value: unknown): OutboxMessage => {
  const dto = envelope(value, "message");
  const message = record(dto.message);
  if (
    !stringFields(message, [
      "id",
      "tenantId",
      "messageType",
      "occurredAt",
      "availableAt",
      "correlationId",
      "orderingKey",
    ]) ||
    message.payload === null ||
    typeof message.payload !== "object" ||
    !["Pending", "Processing", "Published", "Failed"].includes(
      String(message.state),
    ) ||
    !Number.isSafeInteger(message.schemaVersion) ||
    !Number.isSafeInteger(message.orderingSequence) ||
    !Number.isSafeInteger(message.attemptCount)
  ) {
    throw new PersistenceMappingFailure("invalid_outbox_message");
  }
  return copy(message) as unknown as OutboxMessage;
};

export const idempotencyRecordToDto = (
  idempotencyRecord: IdempotencyRecord,
): IdempotencyRecordDto =>
  deepFreeze({ schemaVersion: 1, record: copy(idempotencyRecord) });

export const idempotencyRecordFromDto = (
  value: unknown,
): IdempotencyRecord => {
  const dto = envelope(value, "record");
  const idempotencyRecord = record(dto.record);
  if (
    !stringFields(idempotencyRecord, [
      "key",
      "tenantId",
      "actorReference",
      "operationId",
      "requestFingerprint",
      "reservedAt",
    ]) ||
    !["processing", "completed", "failed"].includes(
      String(idempotencyRecord.state),
    )
  ) {
    throw new PersistenceMappingFailure("invalid_idempotency_record");
  }
  return copy(idempotencyRecord) as unknown as IdempotencyRecord;
};
