import {
  IdempotencyPayloadMismatch,
  PersistenceConcurrencyConflict,
  createAuditEntry,
  createConversationSnapshot,
  createOutboxMessage,
  expectedVersion,
  handleConversationCommand,
  type ActorContext,
  type CanonicalValue,
  type Conversation,
  type ConversationEvent,
  type OutboxMessageId,
  type TransactionContext,
} from "@reviva/conversation";

import { revalidateRuntimeAuthorization } from "./authorization.js";
import type {
  ExecutionRecord,
  HandlerResult,
  RuntimeExecutionRequest,
  RuntimeFailure,
  RuntimePersistence,
  RuntimeReconciliationInstruction,
  RuntimeToolDescriptor,
  RuntimeToolRegistry,
  ToolResult,
  ToolRuntime,
} from "./contracts.js";
import {
  createExecutionRecord,
  transitionExecutionRecord,
} from "./execution-record.js";
import { cloneRuntimeCanonicalValue } from "./internal/canonical.js";
import { deepFreeze } from "./internal/immutable.js";
import {
  InvalidRuntimeRequestConstruction,
  createRuntimeExecutionRequest,
} from "./request.js";
import { createToolResult } from "./result.js";
import { resolveRuntimeHandler } from "./registry.js";

export type CreateToolRuntimeInput = Readonly<{
  registry: RuntimeToolRegistry;
  persistence: RuntimePersistence;
}>;

const failure = (
  code: RuntimeFailure["code"],
  safeReason: string,
): RuntimeFailure => deepFreeze({ code, safeReason });
const safeReasonCode = /^[a-z][a-z0-9._:-]{0,127}$/u;

class RuntimeWriteFailure extends Error {
  constructor(readonly target: "audit" | "outbox") {
    super(`Runtime ${target} write failed.`);
    this.name = "RuntimeWriteFailure";
  }
}

const actorContext = (request: RuntimeExecutionRequest): ActorContext => {
  const delegation = request.authorizationContext.delegation;
  return deepFreeze({
    kind: request.actor.kind,
    actorReference: request.actor.actorReference,
    authenticatedPrincipalReference:
      request.authorizationContext.actor.authenticatedPrincipalReference,
    delegationReference:
      delegation.status === "active"
        ? {
            id: delegation.reference,
            issuedForConversationVersion:
              delegation.issuedForConversationVersion,
          }
        : null,
    tenantId: request.tenantId,
    correlationId: request.correlationId,
    causationId: request.causationId,
  });
};

const finalExecutionStatus = (
  handlerResult: HandlerResult,
): "Succeeded" | "Failed" | "ReconciliationRequired" => {
  if (
    handlerResult.status === "ExternalEffectUncertain" ||
    handlerResult.status === "ReconciliationRequired"
  ) {
    return "ReconciliationRequired";
  }
  if (
    handlerResult.status === "Succeeded" ||
    handlerResult.status === "ExternalEffectDeferred"
  ) {
    return "Succeeded";
  }
  return "Failed";
};

const handlerFailure = (
  handlerResult: HandlerResult,
): RuntimeFailure | null => {
  switch (handlerResult.status) {
    case "Succeeded":
    case "ExternalEffectDeferred":
      return null;
    case "Rejected":
    case "ValidationFailed":
    case "Conflict":
      return failure("HandlerRejected", handlerResult.reasonCode);
    case "RetryableFailure":
      return failure("HandlerRetryableFailure", handlerResult.reasonCode);
    case "DefinitiveFailure":
      return failure("HandlerDefinitiveFailure", handlerResult.reasonCode);
    case "ExternalEffectUncertain":
      return failure("ExternalEffectUncertain", handlerResult.reasonCode);
    case "ReconciliationRequired":
      return failure("ReconciliationRequired", handlerResult.reasonCode);
  }
};

const handlerResultIsStructurallySafe = (
  value: HandlerResult,
  descriptor: RuntimeToolDescriptor,
): HandlerResult => {
  const supported = [
    "Succeeded",
    "ExternalEffectDeferred",
    "Rejected",
    "ValidationFailed",
    "Conflict",
    "RetryableFailure",
    "DefinitiveFailure",
    "ExternalEffectUncertain",
    "ReconciliationRequired",
  ];
  if (
    typeof value !== "object" ||
    value === null ||
    !supported.includes(value.status) ||
    (value.status === "ExternalEffectDeferred" &&
      descriptor.effectClassification !== "DeferredExternal") ||
    (value.status !== "ExternalEffectDeferred" &&
      descriptor.effectClassification === "DeferredExternal" &&
      (value.status === "Succeeded" ||
        value.status === "ExternalEffectUncertain")) ||
    ((value.status === "ExternalEffectUncertain" ||
      value.status === "ReconciliationRequired") &&
      descriptor.effectClassification === "LocalTransactional")
  ) {
    return deepFreeze({
      status: "ValidationFailed",
      reasonCode: "handler_outcome_contract_mismatch",
      safeResult: null,
      conversationCommand: null,
    });
  }
  if (
    "reasonCode" in value &&
    !safeReasonCode.test(value.reasonCode)
  ) {
    return deepFreeze({
      status: "ValidationFailed",
      reasonCode: "handler_reason_code_invalid",
      safeResult: null,
      conversationCommand: null,
    });
  }
  try {
    const safeResult =
      value.safeResult === null
        ? null
        : cloneRuntimeCanonicalValue(value.safeResult);
    if (value.status === "ExternalEffectDeferred") {
      return deepFreeze({
        ...value,
        safeResult,
        deferredEffect: {
          ...value.deferredEffect,
          payload: cloneRuntimeCanonicalValue(value.deferredEffect.payload),
          deliveryPolicy: { ...value.deferredEffect.deliveryPolicy },
        },
      });
    }
    if (
      value.status === "ExternalEffectUncertain" ||
      value.status === "ReconciliationRequired"
    ) {
      return deepFreeze({
        ...value,
        safeResult,
        reconciliationMetadata: cloneRuntimeCanonicalValue(
          value.reconciliationMetadata,
        ),
      });
    }
    return deepFreeze({ ...value, safeResult });
  } catch {
    return deepFreeze({
      status: "ValidationFailed",
      reasonCode: "handler_outcome_not_canonical",
      safeResult: null,
      conversationCommand: null,
    });
  }
};

const terminalRecord = (
  record: ExecutionRecord,
  result: HandlerResult,
  request: RuntimeExecutionRequest,
): ExecutionRecord => {
  const status = finalExecutionStatus(result);
  const runtimeFailure = handlerFailure(result);
  return transitionExecutionRecord(record, {
    to: status,
    occurredAt: request.transaction.requestedAt,
    reasonCode:
      result.status === "ExternalEffectDeferred"
        ? "external_effect_deferred"
        : result.status.toLowerCase(),
    failureCode: runtimeFailure?.code ?? null,
    handlerResult: result,
    reconciliationMetadata:
      result.status === "ExternalEffectUncertain" ||
      result.status === "ReconciliationRequired"
        ? result.reconciliationMetadata
        : null,
  });
};

const resultStatus = (
  result: HandlerResult,
): ToolResult["status"] => {
  switch (result.status) {
    case "Succeeded":
      return "Succeeded";
    case "ExternalEffectDeferred":
      return "ExternalEffectDeferred";
    case "ExternalEffectUncertain":
    case "ReconciliationRequired":
      return "ReconciliationRequired";
    default:
      return "Failed";
  }
};

class CoordinatedToolRuntime implements ToolRuntime {
  readonly #inFlight = new Set<string>();

  constructor(
    private readonly registry: RuntimeToolRegistry,
    private readonly persistence: RuntimePersistence,
  ) {}

  async execute(unsafeRequest: RuntimeExecutionRequest): Promise<ToolResult> {
    let request: RuntimeExecutionRequest;
    try {
      request = createRuntimeExecutionRequest(unsafeRequest);
    } catch (error) {
      const reason =
        error instanceof InvalidRuntimeRequestConstruction
          ? error.reason
          : "request_construction_failed";
      return createToolResult({
        request: null,
        status: "Failed",
        failure: failure("InvalidRuntimeRequest", reason),
      });
    }

    const lookup = this.registry.find(
      request.validatedToolProposal.toolIdentifier,
      request.validatedToolProposal.toolVersion,
    );
    if (!lookup.found) {
      return this.persistDecision(
        request,
        "Denied",
        failure("RuntimeToolNotRegistered", "runtime_tool_not_registered"),
      );
    }
    const descriptor = lookup.descriptor;
    const authorization = revalidateRuntimeAuthorization(
      request,
      descriptor,
      this.registry,
    );
    if (!authorization.allowed) {
      return this.persistDecision(
        request,
        authorization.status,
        authorization.failure,
      );
    }
    const handler = resolveRuntimeHandler(
      this.registry,
      descriptor.tool.identifier,
      descriptor.tool.version,
    );
    if (handler === null) {
      return this.persistDecision(
        request,
        "Failed",
        failure("HandlerNotRegistered", "runtime_handler_not_registered"),
      );
    }

    const inFlightKey = JSON.stringify([
      request.tenantId,
      request.actor.actorReference,
      request.transaction.operationId,
      request.idempotencyKey,
    ]);
    if (this.#inFlight.has(inFlightKey)) {
      return createToolResult({
        request,
        status: "ExecutionAlreadyProcessing",
        failure: failure(
          "ExecutionAlreadyProcessing",
          "runtime_execution_already_processing",
        ),
      });
    }

    this.#inFlight.add(inFlightKey);
    try {
      return await this.executeCoordinated(request, descriptor, handler);
    } catch (error) {
      if (error instanceof RuntimeWriteFailure) {
        return createToolResult({
          request,
          status: "Failed",
          failure: failure(
            error.target === "audit"
              ? "AuditWriteFailed"
              : "OutboxWriteFailed",
            error.target === "audit"
              ? "runtime_audit_write_failed"
              : "runtime_outbox_write_failed",
          ),
        });
      }
      if (error instanceof IdempotencyPayloadMismatch) {
        return createToolResult({
          request,
          status: "Denied",
          failure: failure(
            "IdempotencyPayloadMismatch",
            "idempotency_payload_mismatch",
          ),
        });
      }
      if (error instanceof PersistenceConcurrencyConflict) {
        const staleConversation =
          error.resource === "runtime_conversation_projection";
        return createToolResult({
          request,
          status: "Failed",
          failure: failure(
            staleConversation
              ? "StaleConversationVersion"
              : "TransactionConflict",
            staleConversation
              ? "runtime_conversation_version_stale"
              : "runtime_transaction_conflict",
          ),
        });
      }
      return createToolResult({
        request,
        status: "Failed",
        failure: failure(
          "TransactionInvalidState",
          "runtime_transaction_rolled_back",
        ),
      });
    } finally {
      this.#inFlight.delete(inFlightKey);
    }
  }

  private async persistDecision(
    request: RuntimeExecutionRequest,
    status: "Denied" | "AwaitingConfirmation" | "AwaitingHumanApproval" | "Failed",
    runtimeFailure: RuntimeFailure,
  ): Promise<ToolResult> {
    const result = createToolResult({
      request,
      status,
      projectionVersion: request.expectedConversationVersion,
      failure: runtimeFailure,
    });
    try {
      return await this.persistence.transactionManager.runInTransaction(
        {
          id: request.transaction.transactionId,
          tenantId: request.tenantId,
        },
        async (transaction) => {
          const projection = await this.persistence.projections.get(
            transaction,
            request.tenantId,
            request.conversationId,
          );
          if (
            !projection.found ||
            projection.projection.version !==
              request.expectedConversationVersion ||
            projection.projection.status !== request.currentConversationState
          ) {
            return createToolResult({
              request,
              status: "Failed",
              failure: failure(
                "StaleConversationVersion",
                "runtime_conversation_version_stale",
              ),
            });
          }
          const existing = await this.persistence.executionRecords.get(
            transaction,
            request.tenantId,
            request.runtimeExecutionId,
          );
          if (existing !== null) return result;
          let record = createExecutionRecord(request);
          record = transitionExecutionRecord(record, {
            to:
              status === "AwaitingConfirmation"
                ? "Validated"
                : status === "AwaitingHumanApproval"
                  ? "Validated"
                  : status === "Denied"
                    ? "Denied"
                    : "Denied",
            occurredAt: request.transaction.requestedAt,
            reasonCode: "runtime_revalidation_completed",
            failureCode:
              status === "Denied" || status === "Failed"
                ? runtimeFailure.code
                : null,
          });
          if (status === "AwaitingConfirmation") {
            record = transitionExecutionRecord(record, {
              to: "AwaitingConfirmation",
              occurredAt: request.transaction.requestedAt,
              reasonCode: runtimeFailure.safeReason,
              failureCode: runtimeFailure.code,
            });
          } else if (status === "AwaitingHumanApproval") {
            record = transitionExecutionRecord(record, {
              to: "AwaitingHumanApproval",
              occurredAt: request.transaction.requestedAt,
              reasonCode: runtimeFailure.safeReason,
              failureCode: runtimeFailure.code,
            });
          }
          await this.persistence.executionRecords.save(
            transaction,
            record,
            -1,
          );
          try {
            await this.persistence.audit.append(
              transaction,
              createAuditEntry({
                id: request.artifacts.auditEntryId,
                tenantId: request.tenantId,
                actor: actorContext(request),
                aggregateType: "conversation",
                aggregateId: request.conversationId,
                action: `runtime.${status.toLowerCase()}`,
                aggregateVersion: request.expectedConversationVersion,
                correlationId: request.correlationId,
                occurredAt: request.transaction.requestedAt,
                metadata: {
                  result: runtimeFailure.code,
                  tool: request.validatedToolProposal.toolIdentifier,
                },
              }),
            );
          } catch {
            throw new RuntimeWriteFailure("audit");
          }
          return createToolResult({
            ...result,
            request,
            status,
            projectionVersion: request.expectedConversationVersion,
            failure: runtimeFailure,
            auditIds: [request.artifacts.auditEntryId],
          });
        },
      );
    } catch (error) {
      return createToolResult({
        request,
        status: "Failed",
        failure:
          error instanceof RuntimeWriteFailure &&
          error.target === "audit"
            ? failure(
                "AuditWriteFailed",
                "runtime_audit_write_failed",
              )
            : failure(
                "TransactionInvalidState",
                "runtime_decision_transaction_rolled_back",
              ),
      });
    }
  }

  private async executeCoordinated(
    request: RuntimeExecutionRequest,
    descriptor: RuntimeToolDescriptor,
    handler: NonNullable<ReturnType<typeof resolveRuntimeHandler>>,
  ): Promise<ToolResult> {
    return this.persistence.transactionManager.runInTransaction(
      {
        id: request.transaction.transactionId,
        tenantId: request.tenantId,
      },
      async (transaction) => {
        const reservation = await this.persistence.idempotency.reserve(
          transaction,
          {
            tenantId: request.tenantId,
            actorReference: request.actor.actorReference,
            operationId: request.transaction.operationId,
            key: request.idempotencyKey,
            requestFingerprint: request.idempotencyFingerprint,
            reservedAt: request.transaction.requestedAt,
          },
        );
        if (reservation.kind === "completed") {
          const reference = reservation.record.resultReference;
          const stored =
            reference === null
              ? null
              : await this.persistence.executionRecords.getResult(
                  transaction,
                  request.tenantId,
                  reference,
                );
          if (stored === null) {
            throw new Error("completed_runtime_result_missing");
          }
          return deepFreeze({ ...stored, replayed: true });
        }
        if (reservation.kind === "in_progress") {
          return createToolResult({
            request,
            status: "ExecutionAlreadyProcessing",
            failure: failure(
              "ExecutionAlreadyProcessing",
              "runtime_execution_already_processing",
            ),
          });
        }
        if (reservation.kind === "failed") {
          return createToolResult({
            request,
            status: "Failed",
            failure: failure(
              "HandlerDefinitiveFailure",
              reservation.record.failureCode ?? "prior_execution_failed",
            ),
            replayed: true,
          });
        }

        const projection = await this.persistence.projections.get(
          transaction,
          request.tenantId,
          request.conversationId,
        );
        if (
          !projection.found ||
          projection.projection.version !==
            request.expectedConversationVersion ||
          projection.projection.status !== request.currentConversationState
        ) {
          throw new PersistenceConcurrencyConflict(
            "runtime_conversation_projection",
            request.expectedConversationVersion,
            projection.found ? projection.projection.version : 0,
          );
        }

        let record = createExecutionRecord(request);
        record = transitionExecutionRecord(record, {
          to: "Validated",
          occurredAt: request.transaction.requestedAt,
          reasonCode: "runtime_authorization_revalidated",
        });
        record = transitionExecutionRecord(record, {
          to: "Executing",
          occurredAt: request.transaction.requestedAt,
          reasonCode: "runtime_handler_started",
          incrementAttempt: true,
        });

        let rawHandlerResult: HandlerResult;
        try {
          rawHandlerResult = await handler.handle({
            request,
            descriptor,
            transaction,
            repositories: {
              tenantId: request.tenantId,
              conversationId: request.conversationId,
              currentConversation: () => projection.projection,
            },
            conversation: projection.projection,
            arguments: request.validatedToolProposal.arguments,
            occurredAt: request.transaction.requestedAt,
          });
        } catch {
          rawHandlerResult =
            descriptor.effectClassification === "SynchronousExternal"
              ? {
                  status: "ExternalEffectUncertain",
                  reasonCode: "handler_threw_after_external_effect_may_have_started",
                  reconciliationMetadata: {
                    runtimeExecutionId: request.runtimeExecutionId,
                  },
                  safeResult: null,
                  conversationCommand: null,
                }
              : {
                  status: "DefinitiveFailure",
                  reasonCode: "handler_threw_before_external_effect",
                  safeResult: null,
                  conversationCommand: null,
                };
        }
        const handlerResult = handlerResultIsStructurallySafe(
          rawHandlerResult,
          descriptor,
        );

        let conversation: Conversation = projection.projection;
        let events: readonly ConversationEvent[] = [];
        if (handlerResult.conversationCommand !== null) {
          const outcome = handleConversationCommand(
            conversation,
            handlerResult.conversationCommand,
          );
          if (!outcome.ok) {
            rawHandlerResult = {
              status: "Rejected",
              reasonCode: outcome.failure.code,
              safeResult: null,
              conversationCommand: null,
            };
          } else {
            events = outcome.value.events;
            conversation = outcome.value.conversation;
            await this.persistence.events.append(
              transaction,
              request.tenantId,
              request.conversationId,
              expectedVersion(request.expectedConversationVersion),
              events,
            );
            await this.persistence.projections.save(
              transaction,
              conversation,
              expectedVersion(request.expectedConversationVersion),
            );
            const priorSnapshot = await this.persistence.snapshots.get(
              transaction,
              request.tenantId,
              request.conversationId,
            );
            await this.persistence.snapshots.save(
              transaction,
              createConversationSnapshot(conversation),
              expectedVersion(
                priorSnapshot.found
                  ? priorSnapshot.snapshot.aggregateVersion
                  : 0,
              ),
            );
          }
        }
        const normalizedHandlerResult =
          rawHandlerResult === handlerResult
            ? handlerResult
            : handlerResultIsStructurallySafe(rawHandlerResult, descriptor);

        const outboxIds: OutboxMessageId[] = [];
        if (normalizedHandlerResult.status === "ExternalEffectDeferred") {
          const outboxId = request.artifacts.outboxMessageId;
          if (outboxId === null) {
            throw new Error("deferred_effect_requires_outbox_identifier");
          }
          try {
            await this.persistence.outbox.enqueue(
              transaction,
              createOutboxMessage({
                id: outboxId,
                tenantId: request.tenantId,
                aggregateId: request.conversationId,
                messageType: "runtime.tool.deferred",
                schemaVersion: 1,
                payload: {
                  tenantId: request.tenantId,
                  operationId: request.transaction.operationId,
                  toolIdentifier: descriptor.tool.identifier,
                  toolVersion: descriptor.tool.version,
                  correlationId: request.correlationId,
                  causationId: request.causationId,
                  idempotencyKey: request.idempotencyKey,
                  idempotencyFingerprint: request.idempotencyFingerprint,
                  effectDigest: request.validatedToolProposal.effectDigest,
                  destination:
                    normalizedHandlerResult.deferredEffect.destination,
                  deliveryPolicy:
                    normalizedHandlerResult.deferredEffect.deliveryPolicy,
                  effectPayload:
                    normalizedHandlerResult.deferredEffect.payload,
                } as CanonicalValue,
                occurredAt: request.transaction.requestedAt,
                availableAt: request.transaction.requestedAt,
                correlationId: request.correlationId,
                causationId: request.causationId,
                orderingKey: `conversation-${request.conversationId}`,
                orderingSequence: conversation.version,
              }),
            );
          } catch {
            throw new RuntimeWriteFailure("outbox");
          }
          outboxIds.push(outboxId);
        }

        record = terminalRecord(
          record,
          normalizedHandlerResult,
          request,
        );
        await this.persistence.executionRecords.save(
          transaction,
          record,
          -1,
        );

        const runtimeFailure = handlerFailure(normalizedHandlerResult);
        const reconciliation: RuntimeReconciliationInstruction | null =
          normalizedHandlerResult.status === "ExternalEffectUncertain" ||
          normalizedHandlerResult.status === "ReconciliationRequired"
            ? deepFreeze({
                runtimeExecutionId: request.runtimeExecutionId,
                toolIdentifier: descriptor.tool.identifier,
                effectDigest: request.validatedToolProposal.effectDigest,
                reasonCode: normalizedHandlerResult.reasonCode,
                retryBlindly: false,
              })
            : null;
        const auditAction =
          normalizedHandlerResult.status === "ExternalEffectDeferred"
            ? "runtime.external_effect_deferred"
            : normalizedHandlerResult.status === "Succeeded"
              ? "runtime.execution_committed"
              : normalizedHandlerResult.status === "ExternalEffectUncertain" ||
                  normalizedHandlerResult.status ===
                    "ReconciliationRequired"
                ? "runtime.reconciliation_required"
                : "runtime.execution_failed";
        try {
          await this.persistence.audit.append(
            transaction,
            createAuditEntry({
              id: request.artifacts.auditEntryId,
              tenantId: request.tenantId,
              actor: actorContext(request),
              aggregateType: "conversation",
              aggregateId: request.conversationId,
              action: auditAction,
              aggregateVersion: conversation.version,
              correlationId: request.correlationId,
              occurredAt: request.transaction.requestedAt,
              metadata: {
                status: normalizedHandlerResult.status,
                tool: descriptor.tool.identifier,
                effect: descriptor.effectClassification,
              },
            }),
          );
        } catch {
          throw new RuntimeWriteFailure("audit");
        }
        const result = createToolResult({
          request,
          status: resultStatus(normalizedHandlerResult),
          safeResult: normalizedHandlerResult.safeResult,
          eventIds: events.map((event) => event.eventId),
          projectionVersion: conversation.version,
          outboxIds,
          auditIds: [request.artifacts.auditEntryId],
          attemptCount: record.attemptCount,
          failure: runtimeFailure,
          reconciliation,
        });
        await this.persistence.executionRecords.storeResult(
          transaction,
          request.tenantId,
          request.transaction.resultReference,
          result,
        );
        await this.persistence.idempotency.complete(transaction, {
          tenantId: request.tenantId,
          actorReference: request.actor.actorReference,
          operationId: request.transaction.operationId,
          key: request.idempotencyKey,
          requestFingerprint: request.idempotencyFingerprint,
          resultReference: request.transaction.resultReference,
          completedAt: request.transaction.requestedAt,
        });
        return result;
      },
    );
  }
}

export const createToolRuntime = (
  input: CreateToolRuntimeInput,
): ToolRuntime =>
  Object.freeze(
    new CoordinatedToolRuntime(input.registry, input.persistence),
  );
