export type { LocationId, TenantId } from "@reviva/domain";

export type { Conversation, ConversationChannel } from "./aggregate/conversation.js";
export {
  authorizeCapability,
  authorizeToolRequest,
} from "./authorization/authorization-evaluator.js";
export type {
  ToolAuthorizationRequest,
} from "./authorization/authorization-evaluator.js";
export { createAuthorizationContext } from "./authorization/authorization-context.js";
export type {
  AuthorizationActor,
  AuthorizationContext,
  ConfirmationEvidence,
  DelegationAuthority,
  HumanApprovalEvidence,
  LocationAuthority,
  MembershipAuthority,
} from "./authorization/authorization-context.js";
export { authorizationReasons } from "./authorization/authorization-decision.js";
export type {
  AuthorizationDecision,
  AuthorizationReason,
} from "./authorization/authorization-decision.js";
export {
  DuplicateToolIdentifier,
  DuplicateToolName,
  InvalidAuthorizationContext,
  InvalidToolDescriptor,
} from "./authorization/authorization-failure.js";
export type {
  ToolCapabilityMismatch,
  UnknownTool,
} from "./authorization/authorization-failure.js";
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
  capabilities,
  capability,
  capabilitySetHas,
  createCapabilitySet,
  emptyCapabilitySet,
  intersectCapabilitySets,
  InvalidCapability,
  isCapability,
} from "./capabilities/capability.js";
export type {
  Capability,
  CapabilitySet,
} from "./capabilities/capability.js";
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
export type {
  AuditRepository,
  BeginTransactionInput,
  ConversationEventRepository,
  ConversationEventStream,
  ConversationProjectionRepository,
  ConversationProjectionResult,
  ConversationSnapshotRepository,
  ConversationSnapshotResult,
  IdempotencyRepository,
  OutboxRepository,
  ReserveIdempotencyInput,
  TransactionContext,
  TransactionManager,
  TransactionState,
} from "./persistence/contracts.js";
export {
  ConversationStreamNotFound,
  DuplicatePersistenceIdentifier,
  ForeignTransactionContext,
  HiddenNestedTransaction,
  IdempotencyPayloadMismatch,
  InvalidIdempotencyTransition,
  InvalidOutboxTransition,
  InvalidPersistenceValue,
  PersistenceConcurrencyConflict,
  PersistenceMappingFailure,
  SnapshotIncompatible,
  TenantScopeMismatch,
  TransactionClosed,
} from "./persistence/failures.js";
export {
  createInMemoryConversationPersistence,
} from "./persistence/in-memory-reference.js";
export type {
  InMemoryConversationPersistence,
} from "./persistence/in-memory-reference.js";
export {
  conversationEventFromDto,
  conversationEventToDto,
  conversationSnapshotFromDto,
  conversationSnapshotToDto,
  idempotencyRecordFromDto,
  idempotencyRecordToDto,
  outboxMessageFromDto,
  outboxMessageToDto,
} from "./persistence/mappers.js";
export type {
  ConversationEventDto,
  ConversationSnapshotDto,
  IdempotencyRecordDto,
  OutboxMessageDto,
} from "./persistence/mappers.js";
export {
  createAuditEntry,
  createConversationSnapshot,
  createOutboxMessage,
  hasValidSnapshotIntegrity,
  outboxStates,
} from "./persistence/models.js";
export type {
  AuditEntry,
  ConversationSnapshot,
  CreateAuditEntryInput,
  CreateOutboxMessageInput,
  IdempotencyRecord,
  IdempotencyReservation,
  IdempotencyState,
  OutboxMessage,
  OutboxState,
  SafeAuditMetadataValue,
} from "./persistence/models.js";
export {
  restoreConversationFromSnapshot,
} from "./persistence/replay.js";
export {
  auditEntryId,
  canonicalRequestFingerprint,
  expectedVersion,
  freezeCanonicalValue,
  idempotencyKey,
  operationId,
  outboxMessageId,
  resultReference,
  transactionId,
} from "./persistence/values.js";
export type {
  AuditEntryId,
  CanonicalValue,
  ExpectedVersion,
  IdempotencyKey,
  OperationId,
  OutboxMessageId,
  RequestFingerprint,
  ResultReference,
  TransactionId,
} from "./persistence/values.js";
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
export {
  createToolRegistry,
  toolIdentifier,
} from "./tools/tool-registry.js";
export type {
  ToolDescriptor,
  ToolIdentifier,
  ToolLookupResult,
  ToolRegistry,
} from "./tools/tool-registry.js";
