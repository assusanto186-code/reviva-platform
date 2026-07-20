import type { Conversation } from "../aggregate/conversation.js";
import { createBookingProgress } from "../booking/booking.js";
import type { ConversationEvent } from "../events/events.js";
import {
  conversationFailure,
  conversationSuccess,
  createConversationFailure,
  type ConversationResult,
} from "../failures/failures.js";
import { deepFreeze } from "../internal/immutable.js";

const invalidTransition = <T = Conversation>(
  current: Conversation,
  event: ConversationEvent,
): ConversationResult<T> =>
  conversationFailure(
    createConversationFailure("InvalidStateTransition", {
      state: current.status,
      eventType: event.type,
    }),
  );

const assertEventEnvelope = (
  current: Conversation,
  event: ConversationEvent,
): ConversationResult<true> => {
  if (event.eventVersion !== 1) {
    return conversationFailure(
      createConversationFailure("UnsupportedEventVersion", {
        eventType: event.type,
        eventVersion: event.eventVersion,
      }),
    );
  }
  if (event.conversationId !== current.id || event.tenantId !== current.tenantId) {
    return conversationFailure(createConversationFailure("TenantMismatch"));
  }
  if (event.sequence !== current.lastCommittedSequence + 1) {
    return conversationFailure(
      createConversationFailure("InvalidEventSequence", {
        expected: current.lastCommittedSequence + 1,
        actual: event.sequence,
      }),
    );
  }
  if (current.status === "Closed" && event.type !== "ConversationReopened") {
    return invalidTransition(current, event);
  }
  return conversationSuccess(true);
};

export const applyConversationEvent = (
  current: Conversation | null,
  event: ConversationEvent,
): ConversationResult<Conversation> => {
  if (current === null) {
    if (event.type !== "ConversationStarted" || event.sequence !== 1 || event.eventVersion !== 1) {
      return conversationFailure(
        createConversationFailure("InvalidEventSequence", {
          expectedInitialEvent: "ConversationStarted",
          actualEvent: event.type,
          actualSequence: event.sequence,
        }),
      );
    }

    return conversationSuccess(
      deepFreeze({
        id: event.conversationId,
        tenantId: event.tenantId,
        locationId: event.payload.locationId,
        channel: event.payload.channel,
        participants: [...event.payload.participants],
        status: "New",
        currentOwner: event.payload.initialOwner,
        handoff: null,
        booking: null,
        pendingTool: null,
        reactivation: null,
        contactId: event.payload.contactId,
        version: 1,
        lastCommittedSequence: 1,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        resolvedAt: null,
        closedAt: null,
        closureReason: null,
        failure: null,
      }),
    );
  }

  const envelope = assertEventEnvelope(current, event);
  if (!envelope.ok) return envelope;

  const next = {
    ...current,
    version: current.version + 1,
    lastCommittedSequence: event.sequence,
    updatedAt: event.occurredAt,
  } satisfies Conversation;

  switch (event.type) {
    case "ConversationStarted":
      return invalidTransition(current, event);
    case "InboundMessageRecorded":
      if (["Resolved", "Closed", "Failed"].includes(current.status)) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: current.status === "AwaitingHuman" || current.status === "HandedOff"
          ? current.status
          : "Active",
      }));
    case "OutboundMessageRecorded":
      if (!["Active", "AwaitingUser"].includes(current.status)) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze(next));
    case "ConversationAwaitingUser":
      if (current.status !== "Active") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({ ...next, status: "AwaitingUser" }));
    case "ToolActionProposed":
      if (current.status !== "Active") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze(next));
    case "ConfirmationRequested":
      if (current.status !== "Active" || current.booking === null) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "AwaitingConfirmation",
        booking: {
          ...current.booking,
          confirmation: {
            status: "pending",
            effectDigest: event.payload.effectDigest,
            confirmedAt: null,
            confirmedForVersion: null,
          },
        },
      }));
    case "PatientConfirmed":
      if (current.status !== "AwaitingConfirmation" || current.booking === null) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        booking: {
          ...current.booking,
          confirmation: {
            status: "confirmed",
            effectDigest: event.payload.effectDigest,
            confirmedAt: event.occurredAt,
            confirmedForVersion: next.version,
          },
        },
      }));
    case "PatientConfirmationRejected":
      if (current.status !== "AwaitingConfirmation" || current.booking === null) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "Active",
        booking: {
          ...current.booking,
          confirmation: {
            status: "rejected",
            effectDigest: event.payload.effectDigest,
            confirmedAt: null,
            confirmedForVersion: null,
          },
        },
      }));
    case "ToolExecutionScheduled":
      if (
        current.status !== "Active" &&
        current.status !== "AwaitingConfirmation"
      ) return invalidTransition(current, event);
      if (
        (event.payload.action === "booking.create" || event.payload.action === "booking.modify") &&
        current.status !== "AwaitingConfirmation"
      ) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "AwaitingTool",
        pendingTool: {
          toolIntentId: event.payload.toolIntentId,
          action: event.payload.action,
          effectDigest: event.payload.effectDigest,
        },
      }));
    case "ToolExecutionSucceeded":
      if (current.status !== "AwaitingTool") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: event.payload.nextStatus,
        pendingTool: null,
        resolvedAt: event.payload.nextStatus === "Resolved" ? event.occurredAt : current.resolvedAt,
      }));
    case "ToolExecutionFailed":
      if (current.status !== "AwaitingTool") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: event.payload.recoverable ? "Active" : "Failed",
        pendingTool: null,
        failure: event.payload.recoverable
          ? null
          : { code: event.payload.reasonCode, recoverable: false },
      }));
    case "HumanHandoffRequested":
      if (["Resolved", "Closed", "Failed"].includes(current.status)) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "AwaitingHuman",
        currentOwner: { kind: "unassigned", actorReference: null },
        handoff: {
          id: event.payload.handoffId,
          reason: event.payload.reason,
          urgency: event.payload.urgency,
          requestedAt: event.occurredAt,
          requestedBy: event.actor,
          targetQueueReference: event.payload.targetQueueReference,
          assigneeReference: null,
          acceptedAt: null,
          resolvedAt: null,
          resolution: null,
          aiOperatingMode: "paused",
          responseDeadline: event.payload.responseDeadline,
        },
      }));
    case "HumanHandoffAccepted":
      if (current.status !== "AwaitingHuman" || current.handoff?.id !== event.payload.handoffId) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "HandedOff",
        currentOwner: { kind: "human", actorReference: event.payload.assigneeReference },
        handoff: {
          ...current.handoff,
          assigneeReference: event.payload.assigneeReference,
          acceptedAt: event.occurredAt,
          aiOperatingMode: "assist_only",
        },
      }));
    case "HumanHandoffResolved":
      if (current.status !== "HandedOff" || current.handoff?.id !== event.payload.handoffId) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: event.payload.nextStatus,
        handoff: {
          ...current.handoff,
          resolvedAt: event.occurredAt,
          resolution: event.payload.resolution,
        },
        resolvedAt: event.payload.nextStatus === "Resolved" ? event.occurredAt : null,
      }));
    case "AutomationResumed":
      if (current.status !== "HandedOff") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "Active",
        currentOwner: { kind: "ai", actorReference: event.payload.aiActorReference },
        handoff: current.handoff === null ? null : {
          ...current.handoff,
          resolvedAt: event.occurredAt,
          resolution: "automation_resumed",
          aiOperatingMode: "autonomous",
        },
      }));
    case "ConversationAssigned":
      if (["Closed", "Failed"].includes(current.status)) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({ ...next, currentOwner: event.payload.owner }));
    case "BookingIntentRecorded":
      if (["Resolved", "Closed", "Failed"].includes(current.status)) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: current.status === "New" ? "Active" : current.status,
        booking: createBookingProgress(event.payload.operation),
      }));
    case "BookingProgressUpdated": {
      if (current.booking === null || ["Resolved", "Closed", "Failed"].includes(current.status)) return invalidTransition(current, event);
      const confirmation = event.payload.invalidatesConfirmation
        ? { status: "invalidated" as const, effectDigest: null, confirmedAt: null, confirmedForVersion: null }
        : current.booking.confirmation;
      return conversationSuccess(deepFreeze({
        ...next,
        status: event.payload.invalidatesConfirmation ? "Active" : current.status,
        booking: { ...current.booking, ...event.payload.patch, confirmation },
      }));
    }
    case "ReactivationResponseRecorded": {
      if (["Resolved", "Closed", "Failed"].includes(current.status)) return invalidTransition(current, event);
      const optedOutAt = event.payload.response === "opted_out"
        ? event.occurredAt
        : current.reactivation?.optedOutAt ?? null;
      return conversationSuccess(deepFreeze({
        ...next,
        status: current.status === "New" ? "Active" : current.status,
        reactivation: { ...event.payload, optedOutAt },
        booking: event.payload.response === "converted_to_booking" && current.booking === null
          ? createBookingProgress("create")
          : current.booking,
      }));
    }
    case "ConversationResolved":
      if (["Resolved", "Closed", "Failed"].includes(current.status)) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({ ...next, status: "Resolved", resolvedAt: event.occurredAt }));
    case "ConversationClosed":
      if (current.status === "Closed") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "Closed",
        closedAt: event.occurredAt,
        closureReason: event.payload.reason,
      }));
    case "ConversationReopened":
      if (current.status !== "Closed" && current.status !== "Resolved") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "Active",
        currentOwner: event.payload.owner,
        resolvedAt: null,
        closedAt: null,
        closureReason: null,
      }));
    case "ConversationFailed":
      if (current.status === "Closed") return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "Failed",
        failure: { code: event.payload.failureCode, recoverable: event.payload.recoverable },
      }));
    case "ConversationRecovered":
      if (current.status !== "Failed" || current.failure?.recoverable !== true) return invalidTransition(current, event);
      return conversationSuccess(deepFreeze({
        ...next,
        status: "Active",
        currentOwner: event.payload.owner,
        failure: null,
      }));
  }
};
