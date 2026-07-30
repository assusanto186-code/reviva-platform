import {
  createCapabilitySet,
  emptyCapabilitySet,
  type CanonicalValue,
  type ConversationEventId,
  type OutboxMessageId,
} from "@reviva/conversation";

import type {
  ConversationContinuationDirective,
  HandoffStatus,
  RuntimeExecutionRequest,
  RuntimeFailure,
  RuntimeReconciliationInstruction,
  ToolResult,
  ToolResultStatus,
} from "./contracts.js";
import { cloneRuntimeCanonicalValue } from "./internal/canonical.js";
import { deepFreeze } from "./internal/immutable.js";

export type CreateToolResultInput = Readonly<{
  request: RuntimeExecutionRequest | null;
  status: ToolResultStatus;
  safeResult?: CanonicalValue | null;
  eventIds?: readonly ConversationEventId[];
  projectionVersion?: number | null;
  outboxIds?: readonly OutboxMessageId[];
  auditIds?: readonly RuntimeExecutionRequest["artifacts"]["auditEntryId"][];
  attemptCount?: number;
  failure?: RuntimeFailure | null;
  replayed?: boolean;
  reconciliation?: RuntimeReconciliationInstruction | null;
  handoffStatus?: HandoffStatus | null;
}>;

const directiveFor = (
  status: ToolResultStatus,
): ConversationContinuationDirective => {
  switch (status) {
    case "Succeeded":
    case "ExternalEffectDeferred":
      return "respond_to_patient";
    case "AwaitingConfirmation":
      return "await_patient_confirmation";
    case "AwaitingHumanApproval":
      return "await_operator_approval";
    case "ReconciliationRequired":
      return "reconciliation_pending";
    case "Denied":
      return "handoff_to_human";
    case "ExecutionAlreadyProcessing":
      return "no_further_action";
    case "Failed":
      return "report_safe_failure";
  }
};

export const createToolResult = (
  input: CreateToolResultInput,
): ToolResult => {
  const request = input.request;
  const descriptorCapability =
    request?.validatedToolProposal.requiredCapability;
  const restrictions =
    descriptorCapability === undefined
      ? emptyCapabilitySet()
      : createCapabilitySet([descriptorCapability]);
  const safeResult =
    input.safeResult === undefined || input.safeResult === null
      ? null
      : cloneRuntimeCanonicalValue(input.safeResult);
  const reconciliation = input.reconciliation ?? null;
  return deepFreeze({
    schemaVersion: 1 as const,
    runtimeExecutionId: request?.runtimeExecutionId ?? null,
    toolIdentifier: request?.validatedToolProposal.toolIdentifier ?? null,
    toolVersion: request?.validatedToolProposal.toolVersion ?? null,
    status: input.status,
    replayed: input.replayed ?? false,
    safeResult,
    domainEventIds: [...(input.eventIds ?? [])],
    projectionVersion: input.projectionVersion ?? null,
    outboxMessageIds: [...(input.outboxIds ?? [])],
    auditEntryIds: [...(input.auditIds ?? [])],
    attemptCount: input.attemptCount ?? 0,
    confirmationRequirement:
      input.status === "AwaitingConfirmation" ? "patient" : "none",
    humanApprovalRequirement:
      input.status === "AwaitingHumanApproval" ? "required" : "none",
    handoffInstruction:
      input.status === "Denied" || input.status === "ReconciliationRequired"
        ? "request"
        : input.handoffStatus === "Requested" ||
            input.handoffStatus === "Queued" ||
            input.handoffStatus === "Assigned" ||
            input.handoffStatus === "Accepted"
          ? "retain"
          : "none",
    reconciliation,
    continuation: {
      directive: directiveFor(input.status),
      tenantId: request?.tenantId ?? null,
      conversationId: request?.conversationId ?? null,
      conversationVersion:
        input.projectionVersion ??
        request?.expectedConversationVersion ??
        null,
      correlationId: request?.correlationId ?? null,
      causationId: request?.causationId ?? null,
      handoffStatus: input.handoffStatus ?? null,
      executionOutcome: input.failure?.code ?? input.status,
      capabilityRestrictions: restrictions,
      trustedFacts: safeResult,
    },
    failure: input.failure ?? null,
    correlationId: request?.correlationId ?? null,
    causationId: request?.causationId ?? null,
  });
};
