import type { Conversation } from "../aggregate/conversation.js";
import type { BookingProgressPatch } from "../booking/booking.js";
import {
  requiredCapabilityForCommand,
  type ConversationCommand,
} from "../commands/commands.js";
import type { ConversationEvent } from "../events/events.js";
import {
  conversationFailure,
  conversationSuccess,
  createConversationFailure,
  type ConversationResult,
} from "../failures/failures.js";
import type { CommandHandlingContext } from "../idempotency/contracts.js";
import { deepFreeze } from "../internal/immutable.js";
import {
  bookingPatchInvalidatesConfirmation,
  hasCurrentBookingConfirmation,
  isAutonomousAiEffectEligible,
  isBookingSummaryComplete,
} from "../policies/policies.js";
import { applyConversationEvent } from "./apply-event.js";

export type ConversationCommandOutcome = Readonly<{
  conversation: Conversation;
  events: readonly ConversationEvent[];
  requiredCapability: ReturnType<typeof requiredCapabilityForCommand>;
}>;

type EventOf<Type extends ConversationEvent["type"]> = Extract<
  ConversationEvent,
  { type: Type }
>;

const isIsoTimestamp = (value: string): boolean =>
  value.length > 0 && !Number.isNaN(Date.parse(value));

const isHumanActor = (command: ConversationCommand): boolean =>
  command.actor.kind === "Staff" || command.actor.kind === "HumanOperator";

const isAiEffectCommand = (command: ConversationCommand): boolean =>
  command.type === "RecordOutboundMessage" ||
  command.type === "ProposeToolAction" ||
  command.type === "RequestConfirmation";

const hasMaterialPatch = (patch: BookingProgressPatch): boolean =>
  Object.keys(patch).length > 0;

export const handleConversationCommand = (
  current: Conversation | null,
  command: ConversationCommand,
  context: CommandHandlingContext = { duplicate: { kind: "none" } },
): ConversationResult<ConversationCommandOutcome> => {
  if (context.duplicate.kind === "command") {
    return conversationFailure(
      createConversationFailure("DuplicateCommand", {
        priorVersion: context.duplicate.prior.resultingVersion,
      }),
    );
  }
  if (context.duplicate.kind === "inbound_message") {
    return conversationFailure(createConversationFailure("DuplicateInboundMessage"));
  }
  if (!isIsoTimestamp(command.requestedAt)) {
    return conversationFailure(createConversationFailure("InvalidCommand", { field: "requestedAt" }));
  }
  if (
    command.actor.correlationId !== command.correlationId ||
    command.actor.causationId !== command.causationId
  ) {
    return conversationFailure(createConversationFailure("InvalidCommand", { field: "actor_context" }));
  }

  if (command.type === "StartConversation") {
    if (current !== null || command.expectedVersion !== 0) {
      return conversationFailure(
        createConversationFailure("ConcurrencyConflict", {
          expected: command.expectedVersion,
          actual: current?.version ?? 0,
        }),
      );
    }
    if (command.payload.tenantId !== command.actor.tenantId) {
      return conversationFailure(createConversationFailure("TenantMismatch"));
    }
  } else {
    if (current === null) {
      return conversationFailure(createConversationFailure("ConversationNotFound"));
    }
    if (command.conversationId !== current.id || command.actor.tenantId !== current.tenantId) {
      return conversationFailure(createConversationFailure("TenantMismatch"));
    }
    if (command.expectedVersion !== current.version) {
      return conversationFailure(
        createConversationFailure("ConcurrencyConflict", {
          expected: command.expectedVersion,
          actual: current.version,
        }),
      );
    }
    if (command.actor.kind === "AiAgent" && isAiEffectCommand(command)) {
      if (
        command.actor.delegationReference === null ||
        command.actor.delegationReference.issuedForConversationVersion !== current.version
      ) {
        return conversationFailure(createConversationFailure("StaleAiAction"));
      }
      if (!isAutonomousAiEffectEligible(current)) {
        return conversationFailure(createConversationFailure("HandoffRequired"));
      }
    }
  }

  const tenantId = command.type === "StartConversation"
    ? command.payload.tenantId
    : current!.tenantId;
  const sequence = (current?.lastCommittedSequence ?? 0) + 1;

  const accept = <Type extends ConversationEvent["type"]>(
    type: Type,
    payload: EventOf<Type>["payload"],
  ): ConversationResult<ConversationCommandOutcome> => {
    const event = deepFreeze({
      type,
      eventVersion: 1,
      eventId: command.eventId,
      commandId: command.commandId,
      conversationId: command.conversationId,
      tenantId,
      sequence,
      actor: command.actor,
      occurredAt: command.requestedAt,
      correlationId: command.correlationId,
      causationId: command.causationId,
      payload,
    } as unknown as EventOf<Type>);
    const applied = applyConversationEvent(current, event);
    if (!applied.ok) return applied;
    return conversationSuccess(
      deepFreeze({
        conversation: applied.value,
        events: [event],
        requiredCapability: requiredCapabilityForCommand(command),
      }),
    );
  };

  switch (command.type) {
    case "StartConversation":
      if (command.payload.participants.length === 0) {
        return conversationFailure(createConversationFailure("InvalidCommand", { field: "participants" }));
      }
      return accept("ConversationStarted", command.payload);
    case "RecordInboundMessage":
      if (
        !command.payload.content.trim() ||
        !isIsoTimestamp(command.payload.receivedAt)
      ) {
        return conversationFailure(createConversationFailure("InvalidCommand", { field: "content" }));
      }
      if (
        command.payload.author.kind !== command.actor.kind ||
        command.payload.author.actorReference !== command.actor.actorReference ||
        command.payload.author.tenantId !== command.actor.tenantId
      ) return conversationFailure(createConversationFailure("InvalidCommand", { field: "author" }));
      return accept("InboundMessageRecorded", { ...command.payload, contentKind: "plain_text" });
    case "RecordOutboundMessage":
      if (!command.payload.content.trim() || !isIsoTimestamp(command.payload.sentAt)) {
        return conversationFailure(createConversationFailure("InvalidCommand", { field: "content" }));
      }
      if (
        command.payload.author.kind !== command.actor.kind ||
        command.payload.author.actorReference !== command.actor.actorReference ||
        command.payload.author.tenantId !== command.actor.tenantId
      ) return conversationFailure(createConversationFailure("InvalidCommand", { field: "author" }));
      return accept("OutboundMessageRecorded", { ...command.payload, contentKind: "plain_text" });
    case "MarkAwaitingUser":
      return accept("ConversationAwaitingUser", command.payload);
    case "ProposeToolAction":
      if (command.payload.action === "booking.cancel") {
        return conversationFailure(createConversationFailure("HumanApprovalRequired", { action: "booking.cancel" }));
      }
      return accept("ToolActionProposed", command.payload);
    case "RequestConfirmation":
      if (current!.booking === null || !isBookingSummaryComplete(current!.booking)) {
        return conversationFailure(createConversationFailure("InvalidCommand", { reason: "booking_summary_incomplete" }));
      }
      if (current!.booking.operation === "cancel") {
        return conversationFailure(createConversationFailure("HumanApprovalRequired", { action: "booking.cancel" }));
      }
      return accept("ConfirmationRequested", command.payload);
    case "RecordPatientConfirmation":
      if (command.actor.kind !== "Patient") {
        return conversationFailure(createConversationFailure("InvalidCommand", { actorKind: command.actor.kind }));
      }
      if (
        current!.booking?.confirmation.status !== "pending" ||
        current!.booking.confirmation.effectDigest !== command.payload.effectDigest
      ) {
        return conversationFailure(createConversationFailure("StaleConfirmation"));
      }
      return accept("PatientConfirmed", command.payload);
    case "RejectPatientConfirmation":
      if (command.actor.kind !== "Patient") {
        return conversationFailure(createConversationFailure("InvalidCommand", { actorKind: command.actor.kind }));
      }
      if (
        current!.booking?.confirmation.status !== "pending" ||
        current!.booking.confirmation.effectDigest !== command.payload.effectDigest
      ) {
        return conversationFailure(createConversationFailure("StaleConfirmation"));
      }
      return accept("PatientConfirmationRejected", command.payload);
    case "RecordToolScheduled":
      if (command.payload.action === "booking.cancel") {
        return conversationFailure(createConversationFailure("HumanApprovalRequired", { action: "booking.cancel" }));
      }
      if (
        command.payload.action === "booking.create" ||
        command.payload.action === "booking.modify"
      ) {
        if (
          current!.booking === null ||
          !hasCurrentBookingConfirmation(current!.booking, command.payload.effectDigest)
        ) {
          return conversationFailure(createConversationFailure("ConfirmationRequired"));
        }
      }
      return accept("ToolExecutionScheduled", command.payload);
    case "RecordToolSucceeded":
      if (
        current!.status !== "AwaitingTool" ||
        current!.pendingTool?.toolIntentId !== command.payload.toolIntentId ||
        current!.pendingTool.effectDigest !== command.payload.effectDigest
      ) {
        return conversationFailure(createConversationFailure("StaleToolResult"));
      }
      return accept("ToolExecutionSucceeded", command.payload);
    case "RecordToolFailed":
      if (
        current!.status !== "AwaitingTool" ||
        current!.pendingTool?.toolIntentId !== command.payload.toolIntentId ||
        current!.pendingTool.effectDigest !== command.payload.effectDigest
      ) {
        return conversationFailure(createConversationFailure("StaleToolResult"));
      }
      return accept("ToolExecutionFailed", command.payload);
    case "RequestHumanHandoff":
      return accept("HumanHandoffRequested", command.payload);
    case "AcceptHumanHandoff":
      if (!isHumanActor(command)) {
        return conversationFailure(createConversationFailure("InvalidCommand", { actorKind: command.actor.kind }));
      }
      return accept("HumanHandoffAccepted", command.payload);
    case "ResolveHumanHandoff":
      if (!isHumanActor(command)) {
        return conversationFailure(createConversationFailure("InvalidCommand", { actorKind: command.actor.kind }));
      }
      return accept("HumanHandoffResolved", command.payload);
    case "ResumeAutomation":
      if (!isHumanActor(command)) {
        return conversationFailure(createConversationFailure("InvalidCommand", { actorKind: command.actor.kind }));
      }
      if (command.payload.freshDelegationReference.issuedForConversationVersion !== current!.version) {
        return conversationFailure(createConversationFailure("StaleAiAction"));
      }
      return accept("AutomationResumed", command.payload);
    case "AssignConversation":
      return accept("ConversationAssigned", command.payload);
    case "RecordBookingIntent":
      return accept("BookingIntentRecorded", command.payload);
    case "UpdateBookingProgress":
      if (current!.booking === null || !hasMaterialPatch(command.payload.patch)) {
        return conversationFailure(createConversationFailure("InvalidCommand", { field: "patch" }));
      }
      return accept("BookingProgressUpdated", {
        patch: command.payload.patch,
        invalidatesConfirmation: bookingPatchInvalidatesConfirmation(
          current!.booking,
          command.payload.patch,
        ),
      });
    case "RecordReactivationResponse":
      if (
        current!.reactivation?.response === "opted_out" &&
        command.payload.response !== "opted_out"
      ) {
        return conversationFailure(createConversationFailure("InvalidCommand", { reason: "reactivation_opt_out_is_final" }));
      }
      return accept("ReactivationResponseRecorded", command.payload);
    case "ResolveConversation":
      return accept("ConversationResolved", command.payload);
    case "CloseConversation":
      if (current!.status === "Closed") {
        return conversationFailure(createConversationFailure("ConversationAlreadyClosed"));
      }
      return accept("ConversationClosed", command.payload);
    case "ReopenConversation":
      return accept("ConversationReopened", command.payload);
    case "MarkConversationFailed":
      return accept("ConversationFailed", command.payload);
    case "RecoverConversation":
      if (current!.status !== "Failed" || current!.failure?.recoverable !== true) {
        return conversationFailure(createConversationFailure("ConversationNotRecoverable"));
      }
      return accept("ConversationRecovered", command.payload);
  }
};
