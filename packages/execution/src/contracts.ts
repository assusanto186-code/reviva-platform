import type {
  ActorKind,
  CanonicalValue,
  Capability,
  CapabilitySet,
  CausationId,
  ConversationId,
  ConversationStatus,
  CorrelationId,
  TenantId,
  ToolDescriptor,
  ToolIdentifier,
} from "@reviva/conversation";

import type {
  ExecutionId,
  ModelIdentifier,
  ProviderIdentifier,
  ProviderRequestIdentifier,
  SchemaIdentifier,
} from "./identifiers.js";
import type {
  ExecutionPurpose,
  ExecutionReasonCode,
} from "./purposes.js";

export type ExecutionActor = Readonly<{
  actorReference: string;
  kind: ActorKind;
}>;

export type ExecutionDelegation =
  | Readonly<{ status: "not_required"; reference: null; issuedForVersion: null }>
  | Readonly<{
      status: "current";
      reference: string;
      issuedForVersion: number;
    }>;

export type ExecutionBudget = Readonly<{
  maximumInputTokens: number;
  maximumOutputTokens: number;
  maximumTotalTokens: number;
  maximumProviderAttempts: number;
  maximumRepairAttempts: number;
  maximumFallbacks: number;
  maximumCostMicroUnits: number;
  maximumContextEntries: number;
  maximumToolProposals: number;
  remainingConversationTokens: number;
  remainingConversationCostMicroUnits: number;
  remainingTenantTokens: number;
  remainingTenantCostMicroUnits: number;
  timeoutMilliseconds: number;
}>;

export type ProviderCandidate = Readonly<{
  providerId: ProviderIdentifier;
  modelId: ModelIdentifier;
  allowedPurposes: readonly ExecutionPurpose[];
}>;

export type ProviderPolicy = Readonly<{
  candidates: readonly ProviderCandidate[];
  maximumProviderRetries: number;
  repairAllowed: boolean;
  fallbackAllowed: boolean;
}>;

export type ExecutionRequest = Readonly<{
  schemaVersion: 1;
  executionId: ExecutionId;
  tenantId: TenantId;
  conversationId: ConversationId;
  actor: ExecutionActor;
  correlationId: CorrelationId;
  causationId: CausationId | null;
  conversationVersion: number;
  conversationStatus: ConversationStatus;
  authorizedCapabilities: CapabilitySet;
  delegation: ExecutionDelegation;
  purpose: ExecutionPurpose;
  input: CanonicalValue;
  contextEntries: readonly CanonicalValue[];
  availableTools: readonly ToolDescriptor[];
  inputTokenEstimate: number;
  budget: ExecutionBudget;
  providerPolicy: ProviderPolicy;
}>;

export type StructuredOutputContract = Readonly<{
  schemaId: SchemaIdentifier;
  schemaVersion: 1;
  unknownFields: "reject";
}>;

export type ProviderUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costMicroUnits: number;
}>;

export type ProviderFailureCode =
  | "ProviderUnavailable"
  | "ProviderRateLimited"
  | "ProviderTimedOut"
  | "ProviderRejected"
  | "MalformedProviderResponse";

export type ProviderFailure = Readonly<{
  code: ProviderFailureCode;
  retryable: boolean;
  requestAccepted: boolean;
  safeReason: string;
}>;

export type ProviderUncertainty =
  | "timeout_after_possible_acceptance"
  | "provider_status_unknown"
  | "cancelled_completion_unknown";

export type ProviderResponse =
  | Readonly<{
      kind: "success";
      payload: unknown;
      finishStatus: "completed" | "length_limited";
      usage: ProviderUsage;
      providerRequestId: ProviderRequestIdentifier | null;
    }>
  | Readonly<{ kind: "failure"; failure: ProviderFailure }>
  | Readonly<{
      kind: "uncertain";
      uncertainty: ProviderUncertainty;
      providerRequestId: ProviderRequestIdentifier | null;
    }>;

export type ProviderRequest = Readonly<{
  schemaVersion: 1;
  executionId: ExecutionId;
  tenantId: TenantId;
  conversationId: ConversationId;
  purpose: ExecutionPurpose;
  modelId: ModelIdentifier;
  input: CanonicalValue;
  contextEntries: readonly CanonicalValue[];
  outputContract: StructuredOutputContract;
  timeoutMilliseconds: number;
  maximumOutputTokens: number;
  correlationId: CorrelationId;
  causationId: CausationId | null;
  repair: Readonly<{
    attempt: 1;
    validationFailures: readonly string[];
  }> | null;
}>;

export type ProviderDescriptor = Readonly<{
  providerId: ProviderIdentifier;
  modelIds: readonly ModelIdentifier[];
  supportedPurposes: readonly ExecutionPurpose[];
  capabilities: readonly ProviderCapability[];
}>;

export type ProviderCapability = "structured_output" | "repair";

export interface AIProvider {
  readonly descriptor: ProviderDescriptor;
  infer(
    request: ProviderRequest,
    modelId: ModelIdentifier,
  ): Promise<ProviderResponse>;
}

export type PlannerToolOutput = Readonly<{
  identifier: ToolIdentifier;
  version: string;
  arguments: CanonicalValue;
  confirmationStatus: "not_required" | "required" | "confirmed";
  humanApprovalStatus: "not_required" | "required" | "approved";
}>;

export type PlannerResult = Readonly<{
  schemaVersion: 1;
  purpose: ExecutionPurpose;
  proposedCapability: Capability | null;
  proposedTool: PlannerToolOutput | null;
  confidenceBand: "low" | "medium" | "high";
  patientResponse: string | null;
  operatorSummary: string | null;
  escalation: "none" | "recommend_handoff";
  reasonCodes: readonly ExecutionReasonCode[];
}>;

export interface Planner {
  plan(request: ExecutionRequest): Promise<PlannerResult>;
}

export type StructuredOutputValidation<T> =
  | Readonly<{ valid: true; value: T }>
  | Readonly<{ valid: false; failures: readonly string[] }>;

export interface StructuredOutputSchema<T> {
  readonly contract: StructuredOutputContract;
  validate(
    value: unknown,
    request: ExecutionRequest,
  ): StructuredOutputValidation<T>;
}

export type ToolProposal = Readonly<{
  schemaVersion: 1;
  toolIdentifier: ToolIdentifier;
  toolVersion: string;
  requiredCapability: Capability;
  arguments: CanonicalValue;
  effectDigest: string;
  confirmationStatus: PlannerToolOutput["confirmationStatus"];
  humanApprovalStatus: PlannerToolOutput["humanApprovalStatus"];
  correlationId: CorrelationId;
  sourceExecutionId: ExecutionId;
}>;

export type UsageSummary = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costMicroUnits: number;
  providerAttempts: number;
  repairAttempts: number;
  fallbackCount: number;
}>;

export type ProviderProvenance = Readonly<{
  providerId: ProviderIdentifier;
  modelId: ModelIdentifier;
  providerRequestId: ProviderRequestIdentifier | null;
}>;

export type ReconciliationRequest = Readonly<{
  executionId: ExecutionId;
  tenantId: TenantId;
  conversationId: ConversationId;
  providerId: ProviderIdentifier;
  modelId: ModelIdentifier;
  providerRequestId: ProviderRequestIdentifier | null;
  uncertainty: ProviderUncertainty;
  correlationId: CorrelationId;
}>;

export interface ProviderReconciler {
  reconcile(
    request: ReconciliationRequest,
  ): Promise<
    Readonly<
      | { status: "resolved"; providerResponse: ProviderResponse }
      | { status: "still_uncertain" }
    >
  >;
}

export type ExecutionFailureCode =
  | "InvalidExecutionRequest"
  | "UnsupportedExecutionPurpose"
  | "UnknownProvider"
  | "UnknownModel"
  | "ProviderNotAllowedForPurpose"
  | "InvalidProviderPolicy"
  | "InvalidStructuredOutput"
  | "UnsupportedSchemaVersion"
  | "ToolProposalNotAllowed"
  | "ToolNotRegistered"
  | "ToolCapabilityMismatch"
  | "CapabilityNotAuthorized"
  | "ConfirmationRequired"
  | "HumanApprovalRequired"
  | "ProviderUnavailable"
  | "ProviderRateLimited"
  | "ProviderTimedOut"
  | "ProviderRejected"
  | "MalformedProviderResponse"
  | "RetryBudgetExhausted"
  | "RepairBudgetExhausted"
  | "ExecutionBudgetExceeded"
  | "HandoffRequired";

export type ExecutionFailure = Readonly<{
  code: ExecutionFailureCode;
  safeReason: string;
}>;

export type ExecutionResult =
  | Readonly<{
      status: "Completed";
      executionId: ExecutionId;
      plannerResult: PlannerResult;
      toolProposal: ToolProposal | null;
      usage: UsageSummary;
      provenance: ProviderProvenance;
      correlationId: CorrelationId;
    }>
  | Readonly<{
      status: "HandoffRecommended";
      executionId: ExecutionId;
      plannerResult: PlannerResult;
      usage: UsageSummary;
      provenance: ProviderProvenance;
      correlationId: CorrelationId;
    }>
  | Readonly<{
      status:
        | "Denied"
        | "InvalidRequest"
        | "StructuredOutputInvalid"
        | "ProviderFailed"
        | "BudgetExceeded"
        | "RetryExhausted";
      executionId: ExecutionId | null;
      failure: ExecutionFailure;
      usage: UsageSummary;
      correlationId: CorrelationId | null;
    }>
  | Readonly<{
      status: "ReconciliationRequired";
      executionId: ExecutionId;
      reconciliation: ReconciliationRequest;
      usage: UsageSummary;
      correlationId: CorrelationId;
    }>;

export interface ExecutionEngine {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
