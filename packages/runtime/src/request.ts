import {
  actorKinds,
  auditEntryId,
  causationId,
  commandId,
  conversationEventId,
  conversationId,
  conversationStatuses,
  correlationId,
  createAuthorizationContext,
  expectedVersion,
  idempotencyKey,
  operationId,
  outboxMessageId,
  resultReference,
  toolIdentifier,
  toolIntentId,
  transactionId,
  type CanonicalValue,
  type RequestFingerprint,
} from "@reviva/conversation";
import { executionId } from "@reviva/execution";

import type {
  ConfirmationEvidence,
  HumanApprovalEvidence,
  RuntimeExecutionRequest,
} from "./contracts.js";
import { runtimeExecutionId } from "./identifiers.js";
import {
  cloneRuntimeCanonicalValue,
  cloneSafeStructure,
  runtimeCanonicalFingerprint,
} from "./internal/canonical.js";
import { deepFreeze } from "./internal/immutable.js";

export class InvalidRuntimeRequestConstruction extends Error {
  readonly code = "InvalidRuntimeRequest" as const;

  constructor(readonly reason: string) {
    super(`Runtime execution request is invalid: ${reason}.`);
    this.name = "InvalidRuntimeRequestConstruction";
  }
}

const rootKeys = Object.freeze([
  "schemaVersion",
  "runtimeExecutionId",
  "tenantId",
  "conversationId",
  "actor",
  "correlationId",
  "causationId",
  "expectedConversationVersion",
  "currentConversationState",
  "authorizationContext",
  "validatedToolProposal",
  "confirmationEvidence",
  "humanApprovalEvidence",
  "idempotencyKey",
  "idempotencyFingerprint",
  "transaction",
  "artifacts",
]);

const exactKeys = (
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === expected.length &&
  Object.keys(value).every((key) => expected.includes(key));

const isoTimestamp =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const version = /^[0-9]+(?:\.[0-9]+){0,2}$/u;
const effectDigest = /^sha256:[a-f0-9]{64}$/u;
const safeReference = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u;

const isSafeReference = (value: unknown): value is string =>
  typeof value === "string" && safeReference.test(value);

const assertEvidence = (
  evidence: ConfirmationEvidence | HumanApprovalEvidence,
  approval: boolean,
): void => {
  if (
    evidence.status === "not_required" ||
    evidence.status === "missing"
  ) {
    if (!exactKeys(evidence, ["status"])) {
      throw new InvalidRuntimeRequestConstruction(
        approval
          ? "malformed_human_approval_evidence"
          : "malformed_confirmation_evidence",
      );
    }
    return;
  }
  const keys = [
    "status",
    "tenantId",
    "conversationId",
    "actorReference",
    "effectDigest",
    "conversationVersion",
    "correlationId",
    "recordedAt",
    "expiresAt",
    ...(approval ? ["approverReference"] : []),
  ];
  if (
    !exactKeys(evidence, keys) ||
    (evidence.status !== "current" && evidence.status !== "expired") ||
    typeof evidence.tenantId !== "string" ||
    typeof evidence.conversationId !== "string" ||
    typeof evidence.actorReference !== "string" ||
    !effectDigest.test(evidence.effectDigest) ||
    !Number.isSafeInteger(evidence.conversationVersion) ||
    evidence.conversationVersion < 0 ||
    !isoTimestamp.test(evidence.recordedAt) ||
    (evidence.expiresAt !== null &&
      !isoTimestamp.test(evidence.expiresAt)) ||
    (approval &&
      (!("approverReference" in evidence) ||
        !isSafeReference(evidence.approverReference)))
  ) {
    throw new InvalidRuntimeRequestConstruction(
      approval
        ? "malformed_human_approval_evidence"
        : "malformed_confirmation_evidence",
    );
  }
};

export type RuntimeFingerprintInput = Readonly<
  Pick<
    RuntimeExecutionRequest,
    | "tenantId"
    | "conversationId"
    | "actor"
    | "validatedToolProposal"
  > & {
    operationId: RuntimeExecutionRequest["transaction"]["operationId"];
  }
>;

export const runtimeRequestFingerprint = (
  input: RuntimeFingerprintInput,
): RequestFingerprint =>
  runtimeCanonicalFingerprint({
    schemaVersion: 1,
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    actorReference: input.actor.actorReference,
    actorKind: input.actor.kind,
    operationId: input.operationId,
    toolIdentifier: input.validatedToolProposal.toolIdentifier,
    toolVersion: input.validatedToolProposal.toolVersion,
    requiredCapability: input.validatedToolProposal.requiredCapability,
    effectDigest: input.validatedToolProposal.effectDigest,
    arguments: input.validatedToolProposal.arguments,
  });

export const createRuntimeExecutionRequest = (
  unsafeInput: RuntimeExecutionRequest,
): RuntimeExecutionRequest => {
  if (!exactKeys(unsafeInput, rootKeys) || unsafeInput.schemaVersion !== 1) {
    throw new InvalidRuntimeRequestConstruction("root_shape");
  }
  if (
    typeof unsafeInput.tenantId !== "string" ||
    !unsafeInput.tenantId.trim() ||
    typeof unsafeInput.conversationId !== "string" ||
    !unsafeInput.conversationId.trim() ||
    !exactKeys(unsafeInput.actor, ["actorReference", "kind"]) ||
    !isSafeReference(unsafeInput.actor.actorReference) ||
    typeof unsafeInput.actor.kind !== "string" ||
    !actorKinds.includes(unsafeInput.actor.kind) ||
    !Number.isSafeInteger(unsafeInput.expectedConversationVersion) ||
    unsafeInput.expectedConversationVersion < 1 ||
    !conversationStatuses.includes(unsafeInput.currentConversationState)
  ) {
    throw new InvalidRuntimeRequestConstruction("trusted_identity_or_version");
  }
  const clonedAuthorization = cloneSafeStructure(
    unsafeInput.authorizationContext,
  ) as unknown as RuntimeExecutionRequest["authorizationContext"];
  let authorizationContext: RuntimeExecutionRequest["authorizationContext"];
  try {
    authorizationContext = createAuthorizationContext(clonedAuthorization);
  } catch {
    throw new InvalidRuntimeRequestConstruction("authorization_context");
  }
  if (
    (authorizationContext.actor.authenticatedPrincipalReference !== null &&
      !isSafeReference(
        authorizationContext.actor.authenticatedPrincipalReference,
      )) ||
    (authorizationContext.delegation.status === "active" &&
      !isSafeReference(authorizationContext.delegation.reference))
  ) {
    throw new InvalidRuntimeRequestConstruction(
      "authorization_reference",
    );
  }

  const proposal = unsafeInput.validatedToolProposal;
  if (
    !exactKeys(proposal, [
      "schemaVersion",
      "toolIdentifier",
      "toolVersion",
      "requiredCapability",
      "arguments",
      "effectDigest",
      "confirmationStatus",
      "humanApprovalStatus",
      "correlationId",
      "sourceExecutionId",
    ]) ||
    proposal.schemaVersion !== 1 ||
    !isSafeReference(proposal.sourceExecutionId) ||
    typeof proposal.toolVersion !== "string" ||
    !version.test(proposal.toolVersion) ||
    typeof proposal.effectDigest !== "string" ||
    !effectDigest.test(proposal.effectDigest) ||
    (proposal.confirmationStatus !== "not_required" &&
      proposal.confirmationStatus !== "required") ||
    (proposal.humanApprovalStatus !== "not_required" &&
      proposal.humanApprovalStatus !== "required")
  ) {
    throw new InvalidRuntimeRequestConstruction("validated_tool_proposal");
  }

  if (
    authorizationContext.tenantId !== unsafeInput.tenantId ||
    authorizationContext.conversation.id !== unsafeInput.conversationId ||
    authorizationContext.conversation.tenantId !== unsafeInput.tenantId ||
    authorizationContext.conversation.version !==
      unsafeInput.expectedConversationVersion ||
    authorizationContext.conversation.status !==
      unsafeInput.currentConversationState ||
    authorizationContext.actor.actorReference !==
      unsafeInput.actor.actorReference ||
    authorizationContext.actor.kind !== unsafeInput.actor.kind ||
    proposal.correlationId !== unsafeInput.correlationId
  ) {
    throw new InvalidRuntimeRequestConstruction("trusted_scope_mismatch");
  }

  assertEvidence(unsafeInput.confirmationEvidence, false);
  assertEvidence(unsafeInput.humanApprovalEvidence, true);

  if (
    !exactKeys(unsafeInput.transaction, [
      "transactionId",
      "operationId",
      "resultReference",
      "requestedAt",
      "timeoutMilliseconds",
    ]) ||
    !isoTimestamp.test(unsafeInput.transaction.requestedAt) ||
    !Number.isSafeInteger(unsafeInput.transaction.timeoutMilliseconds) ||
    unsafeInput.transaction.timeoutMilliseconds < 1 ||
    unsafeInput.transaction.timeoutMilliseconds > 120_000
  ) {
    throw new InvalidRuntimeRequestConstruction("transaction_metadata");
  }
  if (
    !exactKeys(unsafeInput.artifacts, [
      "commandId",
      "eventId",
      "toolIntentId",
      "auditEntryId",
      "outboxMessageId",
    ])
  ) {
    throw new InvalidRuntimeRequestConstruction("artifact_identifiers");
  }

  try {
    runtimeExecutionId(unsafeInput.runtimeExecutionId);
    conversationId(unsafeInput.conversationId);
    correlationId(unsafeInput.correlationId);
    if (unsafeInput.causationId !== null) causationId(unsafeInput.causationId);
    toolIdentifier(proposal.toolIdentifier);
    executionId(proposal.sourceExecutionId);
    transactionId(unsafeInput.transaction.transactionId);
    operationId(unsafeInput.transaction.operationId);
    resultReference(unsafeInput.transaction.resultReference);
    idempotencyKey(unsafeInput.idempotencyKey);
    expectedVersion(unsafeInput.expectedConversationVersion);
    commandId(unsafeInput.artifacts.commandId);
    conversationEventId(unsafeInput.artifacts.eventId);
    toolIntentId(unsafeInput.artifacts.toolIntentId);
    auditEntryId(unsafeInput.artifacts.auditEntryId);
    if (unsafeInput.artifacts.outboxMessageId !== null) {
      outboxMessageId(unsafeInput.artifacts.outboxMessageId);
    }
  } catch {
    throw new InvalidRuntimeRequestConstruction("identifier");
  }

  const argumentsValue = cloneRuntimeCanonicalValue(proposal.arguments);
  const clonedProposal = deepFreeze({
    ...proposal,
    arguments: argumentsValue,
  });
  const expectedFingerprint = runtimeRequestFingerprint({
    tenantId: unsafeInput.tenantId,
    conversationId: unsafeInput.conversationId,
    actor: unsafeInput.actor,
    validatedToolProposal: clonedProposal,
    operationId: unsafeInput.transaction.operationId,
  });
  if (expectedFingerprint !== unsafeInput.idempotencyFingerprint) {
    throw new InvalidRuntimeRequestConstruction("idempotency_fingerprint");
  }

  const confirmationEvidence = deepFreeze(
    cloneSafeStructure(unsafeInput.confirmationEvidence),
  ) as unknown as ConfirmationEvidence;
  const humanApprovalEvidence = deepFreeze(
    cloneSafeStructure(unsafeInput.humanApprovalEvidence),
  ) as unknown as HumanApprovalEvidence;

  return deepFreeze({
    schemaVersion: 1 as const,
    runtimeExecutionId: runtimeExecutionId(unsafeInput.runtimeExecutionId),
    tenantId: unsafeInput.tenantId,
    conversationId: conversationId(unsafeInput.conversationId),
    actor: { ...unsafeInput.actor },
    correlationId: correlationId(unsafeInput.correlationId),
    causationId:
      unsafeInput.causationId === null
        ? null
        : causationId(unsafeInput.causationId),
    expectedConversationVersion: unsafeInput.expectedConversationVersion,
    currentConversationState: unsafeInput.currentConversationState,
    authorizationContext,
    validatedToolProposal: clonedProposal,
    confirmationEvidence,
    humanApprovalEvidence,
    idempotencyKey: idempotencyKey(unsafeInput.idempotencyKey),
    idempotencyFingerprint: expectedFingerprint,
    transaction: {
      transactionId: transactionId(unsafeInput.transaction.transactionId),
      operationId: operationId(unsafeInput.transaction.operationId),
      resultReference: resultReference(unsafeInput.transaction.resultReference),
      requestedAt: unsafeInput.transaction.requestedAt,
      timeoutMilliseconds: unsafeInput.transaction.timeoutMilliseconds,
    },
    artifacts: {
      commandId: commandId(unsafeInput.artifacts.commandId),
      eventId: conversationEventId(unsafeInput.artifacts.eventId),
      toolIntentId: toolIntentId(unsafeInput.artifacts.toolIntentId),
      auditEntryId: auditEntryId(unsafeInput.artifacts.auditEntryId),
      outboxMessageId:
        unsafeInput.artifacts.outboxMessageId === null
          ? null
          : outboxMessageId(unsafeInput.artifacts.outboxMessageId),
    },
  });
};
