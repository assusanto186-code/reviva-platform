import {
  auditEntryId,
  canonicalRequestFingerprint,
  createAuditEntry,
  createInMemoryConversationPersistence,
  createOutboxMessage,
  idempotencyKey,
  operationId,
  outboxMessageId,
  resultReference,
  transactionId,
} from "../dist/index.js";
import { createFixture } from "./fixtures.mjs";

export const createPersistenceFixture = () => {
  const domain = createFixture();
  const persistence = createInMemoryConversationPersistence();
  let transactionSerial = 0;

  const history = () => {
    const events = [];
    const projections = [];
    let outcome = domain.expectSuccess(domain.run(null, "StartConversation", {
      tenantId: domain.tenant,
      locationId: domain.location,
      channel: "web",
      participants: [{
        id: "participant-persistence",
        kind: "Patient",
        actorReference: "patient-persistence",
        joinedAt: "2026-07-25T00:00:00.000Z",
      }],
      contactId: domain.contact,
      initialOwner: { kind: "ai", actorReference: "emma" },
    }, { at: "2026-07-25T00:00:00.000Z" }));
    events.push(...outcome.events);
    projections.push(outcome.conversation);

    outcome = domain.expectSuccess(domain.run(
      outcome.conversation,
      "RecordInboundMessage",
      {
        messageId: domain.ids.messageId("message-persistence"),
        author: domain.actor("Patient"),
        content: "Hello",
        externalMessageReference: "external-persistence",
        receivedAt: "2026-07-25T00:01:00.000Z",
      },
      { kind: "Patient", at: "2026-07-25T00:01:00.000Z" },
    ));
    events.push(...outcome.events);
    projections.push(outcome.conversation);

    outcome = domain.expectSuccess(domain.run(
      outcome.conversation,
      "MarkAwaitingUser",
      { reason: "response_recorded" },
      { at: "2026-07-25T00:02:00.000Z" },
    ));
    events.push(...outcome.events);
    projections.push(outcome.conversation);

    return { events, projections, projection: outcome.conversation };
  };

  const txInput = (tenant = domain.tenant) => ({
    id: transactionId(`transaction-${++transactionSerial}`),
    tenantId: tenant,
  });

  const fingerprint = canonicalRequestFingerprint({
    conversationId: String(domain.conversation),
    operation: "message.record",
    payload: { contentReference: "content-a", sequence: 1 },
  });

  const idempotency = (overrides = {}) => ({
    tenantId: domain.tenant,
    actorReference: "staff-a",
    operationId: operationId("conversation.message.record"),
    key: idempotencyKey("request-a"),
    requestFingerprint: fingerprint,
    reservedAt: "2026-07-25T00:03:00.000Z",
    ...overrides,
  });

  const outbox = (event, overrides = {}) => createOutboxMessage({
    id: outboxMessageId("outbox-a"),
    tenantId: domain.tenant,
    aggregateId: domain.conversation,
    messageType: "conversation.event.recorded",
    schemaVersion: 1,
    payload: { eventType: event.type, eventSequence: event.sequence },
    occurredAt: "2026-07-25T00:03:00.000Z",
    availableAt: "2026-07-25T00:03:00.000Z",
    correlationId: event.correlationId,
    causationId: event.causationId,
    orderingKey: "conversation-a",
    orderingSequence: event.sequence,
    ...overrides,
  });

  const audit = (event, overrides = {}) => createAuditEntry({
    id: auditEntryId("audit-a"),
    tenantId: domain.tenant,
    actor: event.actor,
    aggregateType: "conversation",
    aggregateId: domain.conversation,
    action: "conversation.persisted",
    aggregateVersion: event.sequence,
    correlationId: event.correlationId,
    occurredAt: "2026-07-25T00:03:00.000Z",
    metadata: { source: "deterministic_test" },
    ...overrides,
  });

  return {
    domain,
    persistence,
    history,
    txInput,
    fingerprint,
    idempotency,
    outbox,
    audit,
    ids: {
      auditEntryId,
      idempotencyKey,
      outboxMessageId,
      resultReference,
    },
  };
};
