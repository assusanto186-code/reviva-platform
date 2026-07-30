import {
  PersistenceConcurrencyConflict,
  createAuditEntry,
  createConversationSnapshot,
  expectedVersion,
  handleConversationCommand,
  type Conversation,
  type ConversationCommand,
} from "@reviva/conversation";

import type {
  HandoffTransitionRequest,
  HandoffTransitionResult,
  HumanHandoffService,
  RuntimePersistence,
} from "./contracts.js";
import { transitionHandoff } from "./handoff.js";
import { deepFreeze } from "./internal/immutable.js";

const failed = (
  code: Extract<HandoffTransitionResult, { ok: false }>["failure"]["code"],
  safeReason: string,
): HandoffTransitionResult =>
  deepFreeze({ ok: false, failure: { code, safeReason } });

const conversationCommand = (
  request: HandoffTransitionRequest,
  conversation: Conversation,
): ConversationCommand | null => {
  const base = {
    commandId: request.commandId,
    eventId: request.eventId,
    conversationId: request.conversationId,
    expectedVersion: conversation.version,
    actor: request.actor,
    requestedAt: request.occurredAt,
    correlationId: request.correlationId,
    causationId: request.actor.causationId,
  };
  if (request.action === "request") {
    return {
      ...base,
      type: "RequestHumanHandoff",
      payload: {
        handoffId: request.handoffId,
        reason: request.reasonCode,
        urgency: "Normal",
        targetQueueReference: request.targetQueueReference ?? "",
        responseDeadline: null,
      },
    };
  }
  if (request.action === "accept") {
    return {
      ...base,
      type: "AcceptHumanHandoff",
      payload: {
        handoffId: request.handoffId,
        assigneeReference: request.actor.actorReference,
      },
    };
  }
  if (request.action === "return_to_automation") {
    if (request.returnToAutomation === null) return null;
    return {
      ...base,
      type: "ResumeAutomation",
      payload: request.returnToAutomation,
    };
  }
  return null;
};

class CoordinatedHumanHandoffService implements HumanHandoffService {
  constructor(private readonly persistence: RuntimePersistence) {}

  async transition(
    request: HandoffTransitionRequest,
  ): Promise<HandoffTransitionResult> {
    try {
      return await this.persistence.transactionManager.runInTransaction(
        { id: request.transactionId, tenantId: request.tenantId },
        async (transaction) => {
          const projection = await this.persistence.projections.get(
            transaction,
            request.tenantId,
            request.conversationId,
          );
          if (!projection.found) {
            return failed(
              "InvalidHandoffRequest",
              "handoff_conversation_not_found",
            );
          }
          if (
            request.action === "request" &&
            (projection.projection.status === "AwaitingHuman" ||
              projection.projection.status === "HandedOff")
          ) {
            return failed(
              "HandoffAlreadyExists",
              "conversation_handoff_already_active",
            );
          }
          if (
            request.action === "return_to_automation" &&
            request.returnToAutomation === null
          ) {
            return failed(
              "InvalidHandoffRequest",
              "return_delegation_required",
            );
          }
          const current = await this.persistence.handoffs.get(
            transaction,
            request.tenantId,
            request.handoffId,
          );
          const outcome = transitionHandoff(current, request);
          if (!outcome.ok || outcome.duplicate) return outcome;
          let conversation = projection.projection;
          const command = conversationCommand(request, conversation);
          if (command !== null) {
            const commandResult = handleConversationCommand(
              conversation,
              command,
            );
            if (!commandResult.ok) {
              return failed(
                "HandoffTransitionNotAllowed",
                commandResult.failure.code,
              );
            }
            await this.persistence.events.append(
              transaction,
              request.tenantId,
              request.conversationId,
              expectedVersion(conversation.version),
              commandResult.value.events,
            );
            conversation = commandResult.value.conversation;
            await this.persistence.projections.save(
              transaction,
              conversation,
              expectedVersion(projection.projection.version),
            );
            const currentSnapshot =
              await this.persistence.snapshots.get(
                transaction,
                request.tenantId,
                request.conversationId,
              );
            await this.persistence.snapshots.save(
              transaction,
              createConversationSnapshot(conversation),
              expectedVersion(
                currentSnapshot.found
                  ? currentSnapshot.snapshot.aggregateVersion
                  : 0,
              ),
            );
          }
          await this.persistence.handoffs.save(
            transaction,
            outcome.record,
            request.expectedVersion,
          );
          await this.persistence.audit.append(
            transaction,
            createAuditEntry({
              id: request.auditEntryId,
              tenantId: request.tenantId,
              actor: request.actor,
              aggregateType: "conversation",
              aggregateId: request.conversationId,
              action: `handoff.${request.action}`,
              aggregateVersion: conversation.version,
              correlationId: request.correlationId,
              occurredAt: request.occurredAt,
              metadata: {
                status: outcome.record.status,
                reason: request.reasonCode,
              },
            }),
          );
          return outcome;
        },
      );
    } catch (error) {
      return error instanceof PersistenceConcurrencyConflict
        ? failed("HandoffStaleVersion", "handoff_version_stale")
        : failed("InvalidHandoffRequest", "handoff_transaction_failed");
    }
  }
}

export const createHumanHandoffService = (
  persistence: RuntimePersistence,
): HumanHandoffService =>
  Object.freeze(new CoordinatedHumanHandoffService(persistence));
