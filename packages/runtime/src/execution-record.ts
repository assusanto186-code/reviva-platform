import type { RequestFingerprint } from "@reviva/conversation";

import type {
  ExecutionRecord,
  ExecutionStatus,
  RuntimeExecutionRequest,
  RuntimeFailureCode,
} from "./contracts.js";
import { runtimeCanonicalFingerprint } from "./internal/canonical.js";
import { deepFreeze } from "./internal/immutable.js";

export class InvalidExecutionRecordTransition extends Error {
  readonly code = "InvalidExecutionRecordTransition" as const;

  constructor(
    readonly from: ExecutionStatus,
    readonly to: ExecutionStatus,
  ) {
    super(`Execution record cannot transition from ${from} to ${to}.`);
    this.name = "InvalidExecutionRecordTransition";
  }
}

const transitions: Readonly<Record<ExecutionStatus, readonly ExecutionStatus[]>> =
  Object.freeze({
    Proposed: ["Validated", "Denied", "Cancelled"],
    Validated: [
      "AwaitingConfirmation",
      "AwaitingHumanApproval",
      "Executing",
      "Denied",
      "Cancelled",
    ],
    AwaitingConfirmation: ["Validated", "Cancelled"],
    AwaitingHumanApproval: ["Validated", "Cancelled"],
    Executing: ["Succeeded", "Failed", "ReconciliationRequired"],
    Succeeded: [],
    Denied: [],
    Failed: [],
    ReconciliationRequired: ["Succeeded", "Failed", "Cancelled"],
    Cancelled: [],
  });

export const createExecutionRecord = (
  request: RuntimeExecutionRequest,
): ExecutionRecord =>
  deepFreeze({
    schemaVersion: 1 as const,
    id: request.runtimeExecutionId,
    tenantId: request.tenantId,
    conversationId: request.conversationId,
    actorReference: request.actor.actorReference,
    actorKind: request.actor.kind,
    toolIdentifier: request.validatedToolProposal.toolIdentifier,
    toolVersion: request.validatedToolProposal.toolVersion,
    capability: request.validatedToolProposal.requiredCapability,
    proposalDigest: request.validatedToolProposal.effectDigest,
    idempotencyKey: request.idempotencyKey,
    idempotencyFingerprint: request.idempotencyFingerprint,
    status: "Proposed" as const,
    attemptCount: 0,
    expectedConversationVersion: request.expectedConversationVersion,
    correlationId: request.correlationId,
    causationId: request.causationId,
    safeFailureCode: null,
    handlerResultDigest: null,
    reconciliationMetadata: null,
    createdAt: request.transaction.requestedAt,
    updatedAt: request.transaction.requestedAt,
    revision: 0,
    transitions: [
      {
        from: null,
        to: "Proposed" as const,
        occurredAt: request.transaction.requestedAt,
        reasonCode: "runtime_request_received",
      },
    ],
  });

export type TransitionExecutionRecordInput = Readonly<{
  to: ExecutionStatus;
  occurredAt: string;
  reasonCode: string;
  failureCode?: RuntimeFailureCode | null;
  handlerResult?: unknown;
  reconciliationMetadata?: ExecutionRecord["reconciliationMetadata"];
  incrementAttempt?: boolean;
}>;

export const transitionExecutionRecord = (
  current: ExecutionRecord,
  input: TransitionExecutionRecordInput,
): ExecutionRecord => {
  if (!transitions[current.status].includes(input.to)) {
    throw new InvalidExecutionRecordTransition(current.status, input.to);
  }
  const resultDigest: RequestFingerprint | null =
    input.handlerResult === undefined
      ? current.handlerResultDigest
      : runtimeCanonicalFingerprint(input.handlerResult);
  return deepFreeze({
    ...current,
    status: input.to,
    attemptCount:
      current.attemptCount + (input.incrementAttempt === true ? 1 : 0),
    safeFailureCode: input.failureCode ?? null,
    handlerResultDigest: resultDigest,
    reconciliationMetadata:
      input.reconciliationMetadata ?? current.reconciliationMetadata,
    updatedAt: input.occurredAt,
    revision: current.revision + 1,
    transitions: [
      ...current.transitions,
      {
        from: current.status,
        to: input.to,
        occurredAt: input.occurredAt,
        reasonCode: input.reasonCode,
      },
    ],
  });
};
