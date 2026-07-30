import type {
  ActorContext,
  ActorKind,
  AuditEntryId,
  AuditRepository,
  AuthorizationContext,
  CanonicalValue,
  Capability,
  CapabilitySet,
  CausationId,
  CommandId,
  ConfirmationEvidence as DomainConfirmationEvidence,
  Conversation,
  ConversationCommand,
  ConversationEventId,
  ConversationEventRepository,
  ConversationId,
  ConversationProjectionRepository,
  ConversationSnapshotRepository,
  ConversationStatus,
  CorrelationId,
  DelegationReference,
  HandoffId,
  HumanApprovalEvidence as DomainHumanApprovalEvidence,
  IdempotencyKey,
  IdempotencyRepository,
  OperationId,
  OutboxMessageId,
  OutboxRepository,
  RequestFingerprint,
  ResultReference,
  TenantId,
  ToolDescriptor,
  ToolIdentifier,
  ToolIntentId,
  TransactionContext,
  TransactionId,
  TransactionManager,
} from "@reviva/conversation";
import type { ToolProposal } from "@reviva/execution";

import type {
  HandoffTransitionId,
  RuntimeExecutionId,
  RuntimeHandlerIdentifier,
} from "./identifiers.js";

export type RuntimeEffectClassification =
  | "LocalTransactional"
  | "DeferredExternal"
  | "SynchronousExternal";

export type RuntimeExecutionMode =
  | "single_transaction"
  | "deferred_outbox"
  | "synchronous_external";

export type RuntimeToolDescriptor = Readonly<{
  tool: ToolDescriptor;
  handlerIdentifier: RuntimeHandlerIdentifier;
  executionMode: RuntimeExecutionMode;
  idempotency: "required" | "optional";
  timeoutClass: "short" | "standard" | "long";
  effectClassification: RuntimeEffectClassification;
  resultSchema: string;
}>;

export type RuntimeToolLookup =
  | Readonly<{ found: true; descriptor: RuntimeToolDescriptor }>
  | Readonly<{
      found: false;
      failure: Readonly<{ code: "RuntimeToolNotRegistered" }>;
    }>;

export interface RuntimeToolRegistry {
  find(toolIdentifier: string, version: string): RuntimeToolLookup;
  list(): readonly RuntimeToolDescriptor[];
}

type ScopedEvidence = Readonly<{
  tenantId: TenantId;
  conversationId: ConversationId;
  actorReference: string;
  effectDigest: string;
  conversationVersion: number;
  correlationId: CorrelationId;
  recordedAt: string;
  expiresAt: string | null;
}>;

export type ConfirmationEvidence =
  | Readonly<{ status: "not_required" | "missing" }>
  | (ScopedEvidence & Readonly<{ status: "current" | "expired" }>);

export type HumanApprovalEvidence =
  | Readonly<{ status: "not_required" | "missing" }>
  | (ScopedEvidence &
      Readonly<{
        status: "current" | "expired";
        approverReference: string;
      }>);

export type RuntimeTransactionMetadata = Readonly<{
  transactionId: TransactionId;
  operationId: OperationId;
  resultReference: ResultReference;
  requestedAt: string;
  timeoutMilliseconds: number;
}>;

export type RuntimeArtifactIdentifiers = Readonly<{
  commandId: CommandId;
  eventId: ConversationEventId;
  toolIntentId: ToolIntentId;
  auditEntryId: AuditEntryId;
  outboxMessageId: OutboxMessageId | null;
}>;

export type RuntimeExecutionRequest = Readonly<{
  schemaVersion: 1;
  runtimeExecutionId: RuntimeExecutionId;
  tenantId: TenantId;
  conversationId: ConversationId;
  actor: Readonly<{
    actorReference: string;
    kind: ActorKind;
  }>;
  correlationId: CorrelationId;
  causationId: CausationId | null;
  expectedConversationVersion: number;
  currentConversationState: ConversationStatus;
  authorizationContext: AuthorizationContext;
  validatedToolProposal: ToolProposal;
  confirmationEvidence: ConfirmationEvidence;
  humanApprovalEvidence: HumanApprovalEvidence;
  idempotencyKey: IdempotencyKey;
  idempotencyFingerprint: RequestFingerprint;
  transaction: RuntimeTransactionMetadata;
  artifacts: RuntimeArtifactIdentifiers;
}>;

export type ConversationContinuationDirective =
  | "respond_to_patient"
  | "await_patient_confirmation"
  | "await_operator_approval"
  | "continue_execution"
  | "handoff_to_human"
  | "report_safe_failure"
  | "reconciliation_pending"
  | "no_further_action";

export type ConversationContinuation = Readonly<{
  directive: ConversationContinuationDirective;
  tenantId: TenantId | null;
  conversationId: ConversationId | null;
  conversationVersion: number | null;
  correlationId: CorrelationId | null;
  causationId: CausationId | null;
  handoffStatus: HandoffStatus | null;
  executionOutcome: string;
  capabilityRestrictions: CapabilitySet;
  trustedFacts: CanonicalValue | null;
}>;

export type RuntimeFailureCode =
  | "InvalidRuntimeRequest"
  | "StaleConversationVersion"
  | "RuntimeToolNotRegistered"
  | "RuntimeToolSchemaMismatch"
  | "CapabilityNotAuthorized"
  | "ActorNotAllowed"
  | "DelegationDenied"
  | "ConfirmationRequired"
  | "ConfirmationExpired"
  | "ConfirmationContextMismatch"
  | "HumanApprovalRequired"
  | "ApprovalExpired"
  | "ApprovalContextMismatch"
  | "HandoffRestriction"
  | "IdempotencyPayloadMismatch"
  | "ExecutionAlreadyProcessing"
  | "TransactionConflict"
  | "TransactionInvalidState"
  | "HandlerNotRegistered"
  | "HandlerRejected"
  | "HandlerRetryableFailure"
  | "HandlerDefinitiveFailure"
  | "ExternalEffectUncertain"
  | "RuntimeBudgetExceeded"
  | "OutboxWriteFailed"
  | "AuditWriteFailed"
  | "ProjectionConflict"
  | "ReconciliationRequired";

export type RuntimeFailure = Readonly<{
  code: RuntimeFailureCode;
  safeReason: string;
}>;

export type RuntimeReconciliationInstruction = Readonly<{
  runtimeExecutionId: RuntimeExecutionId;
  toolIdentifier: ToolIdentifier;
  effectDigest: string;
  reasonCode: string;
  retryBlindly: false;
}>;

export type ToolResultStatus =
  | "Succeeded"
  | "ExternalEffectDeferred"
  | "Denied"
  | "AwaitingConfirmation"
  | "AwaitingHumanApproval"
  | "ExecutionAlreadyProcessing"
  | "Failed"
  | "ReconciliationRequired";

export type ToolResult = Readonly<{
  schemaVersion: 1;
  runtimeExecutionId: RuntimeExecutionId | null;
  toolIdentifier: ToolIdentifier | null;
  toolVersion: string | null;
  status: ToolResultStatus;
  replayed: boolean;
  safeResult: CanonicalValue | null;
  domainEventIds: readonly ConversationEventId[];
  projectionVersion: number | null;
  outboxMessageIds: readonly OutboxMessageId[];
  auditEntryIds: readonly AuditEntryId[];
  attemptCount: number;
  confirmationRequirement: "none" | "patient" | "operator";
  humanApprovalRequirement: "none" | "required";
  handoffInstruction: "none" | "request" | "retain";
  reconciliation: RuntimeReconciliationInstruction | null;
  continuation: ConversationContinuation;
  failure: RuntimeFailure | null;
  correlationId: CorrelationId | null;
  causationId: CausationId | null;
}>;

export type RuntimeExecutionResult = ToolResult;

export type DeferredExternalEffect = Readonly<{
  destination:
    | "booking_gateway"
    | "messaging_gateway"
    | "operator_notification";
  payload: CanonicalValue;
  deliveryPolicy: Readonly<{
    maximumAttempts: number;
    orderingRequired: boolean;
  }>;
}>;

type HandlerOutcomeBase = Readonly<{
  safeResult: CanonicalValue | null;
  conversationCommand: ConversationCommand | null;
}>;

export type HandlerResult =
  | (HandlerOutcomeBase & Readonly<{ status: "Succeeded" }>)
  | (HandlerOutcomeBase &
      Readonly<{
        status: "ExternalEffectDeferred";
        deferredEffect: DeferredExternalEffect;
      }>)
  | (HandlerOutcomeBase &
      Readonly<{
        status:
          | "Rejected"
          | "ValidationFailed"
          | "Conflict"
          | "RetryableFailure"
          | "DefinitiveFailure";
        reasonCode: string;
      }>)
  | (HandlerOutcomeBase &
      Readonly<{
        status: "ExternalEffectUncertain" | "ReconciliationRequired";
        reasonCode: string;
        reconciliationMetadata: CanonicalValue;
      }>);

export type HandlerContext = Readonly<{
  request: RuntimeExecutionRequest;
  descriptor: RuntimeToolDescriptor;
  transaction: TransactionContext;
  repositories: Readonly<{
    tenantId: TenantId;
    conversationId: ConversationId;
    currentConversation(): Conversation;
  }>;
  conversation: Conversation;
  arguments: CanonicalValue;
  occurredAt: string;
}>;

export interface ToolHandler {
  readonly identifier: RuntimeHandlerIdentifier;
  readonly toolIdentifier: ToolIdentifier;
  readonly toolVersion: string;
  handle(context: HandlerContext): Promise<HandlerResult> | HandlerResult;
}

export type RuntimeToolRegistration = Readonly<{
  descriptor: RuntimeToolDescriptor;
  handler: ToolHandler;
}>;

export type ExecutionStatus =
  | "Proposed"
  | "Validated"
  | "AwaitingConfirmation"
  | "AwaitingHumanApproval"
  | "Executing"
  | "Succeeded"
  | "Denied"
  | "Failed"
  | "ReconciliationRequired"
  | "Cancelled";

export type ExecutionRecordTransition = Readonly<{
  from: ExecutionStatus | null;
  to: ExecutionStatus;
  occurredAt: string;
  reasonCode: string;
}>;

export type ExecutionRecord = Readonly<{
  schemaVersion: 1;
  id: RuntimeExecutionId;
  tenantId: TenantId;
  conversationId: ConversationId;
  actorReference: string;
  actorKind: ActorKind;
  toolIdentifier: ToolIdentifier;
  toolVersion: string;
  capability: Capability;
  proposalDigest: string;
  idempotencyKey: IdempotencyKey;
  idempotencyFingerprint: RequestFingerprint;
  status: ExecutionStatus;
  attemptCount: number;
  expectedConversationVersion: number;
  correlationId: CorrelationId;
  causationId: CausationId | null;
  safeFailureCode: RuntimeFailureCode | null;
  handlerResultDigest: RequestFingerprint | null;
  reconciliationMetadata: CanonicalValue | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
  transitions: readonly ExecutionRecordTransition[];
}>;

export interface ExecutionRecordRepository {
  get(
    context: TransactionContext,
    tenantId: TenantId,
    id: RuntimeExecutionId,
  ): Promise<ExecutionRecord | null>;
  save(
    context: TransactionContext,
    record: ExecutionRecord,
    expectedRevision: number,
  ): Promise<void>;
  storeResult(
    context: TransactionContext,
    tenantId: TenantId,
    reference: ResultReference,
    result: ToolResult,
  ): Promise<void>;
  getResult(
    context: TransactionContext,
    tenantId: TenantId,
    reference: ResultReference,
  ): Promise<ToolResult | null>;
}

export const handoffStatuses = [
  "NotRequested",
  "Requested",
  "Queued",
  "Assigned",
  "Accepted",
  "Resolved",
  "ReturnedToAutomation",
  "Cancelled",
] as const;

export type HandoffStatus = (typeof handoffStatuses)[number];

export type HandoffTransition = Readonly<{
  id: HandoffTransitionId;
  from: HandoffStatus;
  to: HandoffStatus;
  actorReference: string;
  actorKind: ActorKind;
  reasonCode: string;
  occurredAt: string;
  correlationId: CorrelationId;
}>;

export type HandoffRecord = Readonly<{
  schemaVersion: 1;
  id: HandoffId;
  tenantId: TenantId;
  conversationId: ConversationId;
  status: HandoffStatus;
  reasonCode: string;
  targetQueueReference: string;
  assigneeReference: string | null;
  requestedBy: string;
  requestedAt: string;
  acceptedAt: string | null;
  resolvedAt: string | null;
  returnedToAutomationAt: string | null;
  correlationId: CorrelationId;
  version: number;
  transitions: readonly HandoffTransition[];
}>;

export type HandoffAction =
  | "request"
  | "queue"
  | "assign"
  | "accept"
  | "resolve"
  | "return_to_automation"
  | "cancel";

export type HandoffTransitionRequest = Readonly<{
  action: HandoffAction;
  transitionId: HandoffTransitionId;
  transactionId: TransactionId;
  auditEntryId: AuditEntryId;
  commandId: CommandId;
  eventId: ConversationEventId;
  handoffId: HandoffId;
  tenantId: TenantId;
  conversationId: ConversationId;
  expectedVersion: number;
  actor: ActorContext &
    Readonly<{
      role: "owner" | "admin" | "manager" | "agent" | "viewer" | null;
    }>;
  reasonCode: string;
  targetQueueReference: string | null;
  assigneeReference: string | null;
  returnToAutomation: Readonly<{
    freshDelegationReference: DelegationReference;
    aiActorReference: string;
  }> | null;
  occurredAt: string;
  correlationId: CorrelationId;
}>;

export type HandoffFailure = Readonly<{
  code:
    | "InvalidHandoffRequest"
    | "HandoffNotFound"
    | "HandoffAlreadyExists"
    | "HandoffTransitionNotAllowed"
    | "HandoffStaleVersion"
    | "HandoffTenantMismatch"
    | "HandoffActorNotAllowed"
    | "HandoffAssignmentMismatch";
  safeReason: string;
}>;

export type HandoffTransitionResult =
  | Readonly<{ ok: true; record: HandoffRecord; duplicate: boolean }>
  | Readonly<{ ok: false; failure: HandoffFailure }>;

export interface HandoffRepository {
  get(
    context: TransactionContext,
    tenantId: TenantId,
    handoffId: HandoffId,
  ): Promise<HandoffRecord | null>;
  save(
    context: TransactionContext,
    record: HandoffRecord,
    expectedVersion: number,
  ): Promise<void>;
}

export type RuntimePersistence = Readonly<{
  transactionManager: TransactionManager;
  events: ConversationEventRepository;
  projections: ConversationProjectionRepository;
  snapshots: ConversationSnapshotRepository;
  idempotency: IdempotencyRepository;
  outbox: OutboxRepository;
  audit: AuditRepository;
  executionRecords: ExecutionRecordRepository;
  handoffs: HandoffRepository;
}>;

export interface ToolRuntime {
  execute(
    request: RuntimeExecutionRequest,
  ): Promise<RuntimeExecutionResult>;
}

export interface HumanHandoffService {
  transition(
    request: HandoffTransitionRequest,
  ): Promise<HandoffTransitionResult>;
}

export type RuntimeComposition = Readonly<{
  registry: RuntimeToolRegistry;
  toolRuntime: ToolRuntime;
  handoffs: HumanHandoffService;
}>;

export interface BookingGateway {
  execute(
    operation: CanonicalValue,
  ): Promise<
    Readonly<
      | { status: "succeeded"; result: CanonicalValue }
      | { status: "rejected"; reasonCode: string }
      | { status: "uncertain"; reconciliationMetadata: CanonicalValue }
    >
  >;
}

export interface MessagingGateway {
  send(
    message: CanonicalValue,
  ): Promise<
    Readonly<
      | { status: "accepted"; reference: string }
      | { status: "rejected"; reasonCode: string }
      | { status: "uncertain"; reconciliationMetadata: CanonicalValue }
    >
  >;
}

export interface OperatorNotificationGateway {
  notify(
    notification: CanonicalValue,
  ): Promise<Readonly<{ status: "accepted" | "rejected"; reasonCode: string }>>;
}

export type RuntimeAuthorizationEvidence = Readonly<{
  confirmation: DomainConfirmationEvidence;
  humanApproval: DomainHumanApprovalEvidence;
}>;

export type RuntimeActorContext = ActorContext;
