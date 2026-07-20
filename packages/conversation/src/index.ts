export type { LocationId, TenantId } from "@reviva/domain";

export type { Conversation, ConversationChannel } from "./aggregate/conversation.js";
export {
  createBookingProgress,
  unknownBookingField,
} from "./booking/booking.js";
export type {
  BookingConfirmation,
  BookingConfirmationStatus,
  BookingField,
  BookingFieldStatus,
  BookingOperation,
  BookingProgress,
  BookingProgressPatch,
} from "./booking/booking.js";
export {
  conversationCapabilities,
  requiredCapabilityForCommand,
} from "./commands/commands.js";
export type {
  AcceptHumanHandoff,
  AssignConversation,
  CloseConversation,
  ConversationCapability,
  ConversationCommand,
  MarkAwaitingUser,
  MarkConversationFailed,
  ProposeToolAction,
  RecordBookingIntent,
  RecordInboundMessage,
  RecordOutboundMessage,
  RecordPatientConfirmation,
  RecordReactivationResponse,
  RecordToolFailed,
  RecordToolScheduled,
  RecordToolSucceeded,
  RecoverConversation,
  RejectPatientConfirmation,
  ReopenConversation,
  RequestConfirmation,
  RequestHumanHandoff,
  ResolveConversation,
  ResolveHumanHandoff,
  ResumeAutomation,
  StartConversation,
  UpdateBookingProgress,
} from "./commands/commands.js";
export type {
  AutomationResumed,
  BookingIntentRecorded,
  BookingProgressUpdated,
  ConfirmationRequested,
  ConversationAssigned,
  ConversationClosed,
  ConversationEvent,
  ConversationFailed,
  ConversationReopened,
  ConversationResolved,
  ConversationStarted,
  ConversationRecovered,
  ConversationAwaitingUser,
  HumanHandoffAccepted,
  HumanHandoffRequested,
  HumanHandoffResolved,
  InboundMessageRecorded,
  OutboundMessageRecorded,
  PatientConfirmationRejected,
  PatientConfirmed,
  ReactivationResponseRecorded,
  ToolActionProposed,
  ToolExecutionFailed,
  ToolExecutionScheduled,
  ToolExecutionSucceeded,
} from "./events/events.js";
export {
  conversationFailure,
  conversationFailureCodes,
  conversationSuccess,
  createConversationFailure,
} from "./failures/failures.js";
export type {
  ConversationFailure,
  ConversationFailureCode,
  ConversationResult,
  SafeFailureContextValue,
} from "./failures/failures.js";
export type { AiOperatingMode, HandoffState, HandoffUrgency } from "./handoff/handoff.js";
export type {
  DuplicateCheck,
  CommandHandlingContext,
  KnownCommandOutcome,
} from "./idempotency/contracts.js";
export {
  causationId,
  commandId,
  contactId,
  conversationEventId,
  conversationId,
  correlationId,
  handoffId,
  InvalidConversationIdentifier,
  messageId,
  participantId,
  toolIntentId,
} from "./identifiers/identifiers.js";
export type {
  CausationId,
  CommandId,
  ContactId,
  ConversationEventId,
  ConversationId,
  CorrelationId,
  HandoffId,
  MessageId,
  ParticipantId,
  ToolIntentId,
} from "./identifiers/identifiers.js";
export { actorKinds } from "./participants/participants.js";
export type {
  ActorContext,
  ActorKind,
  ConversationOwner,
  DelegationReference,
  Participant,
} from "./participants/participants.js";
export {
  bookingPatchInvalidatesConfirmation,
  canReopenConversation,
  hasCurrentBookingConfirmation,
  isAutonomousAiEffectEligible,
  isBookingSummaryComplete,
} from "./policies/policies.js";
export type { ReactivationProgress, ReactivationResponse } from "./reactivation/reactivation.js";
export { rehydrateConversation } from "./rehydration/rehydrate.js";
export { applyConversationEvent } from "./state-machine/apply-event.js";
export { handleConversationCommand } from "./state-machine/handle-command.js";
export type { ConversationCommandOutcome } from "./state-machine/handle-command.js";
export {
  activeConversationStatuses,
  autonomousAiForbiddenStatuses,
  conversationStatuses,
  reopenableConversationStatuses,
  terminalConversationStatuses,
  waitingConversationStatuses,
} from "./state-machine/states.js";
export type { ConversationStatus } from "./state-machine/states.js";
