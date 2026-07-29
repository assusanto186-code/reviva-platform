import {
  actorKinds,
  canonicalRequestFingerprint,
  conversationStatuses,
  createCapabilitySet,
  createToolRegistry,
} from "@reviva/conversation";

import type {
  ExecutionBudget,
  ExecutionRequest,
  ProviderPolicy,
} from "./contracts.js";
import {
  executionId,
  modelIdentifier,
  providerIdentifier,
} from "./identifiers.js";
import { cloneCanonicalValue } from "./internal/canonical.js";
import { deepFreeze } from "./internal/immutable.js";
import { executionPurposeDefinition } from "./purposes.js";

export class InvalidExecutionRequestConstruction extends Error {
  readonly code = "InvalidExecutionRequest" as const;

  constructor(readonly reason: string) {
    super("Execution request construction failed.");
    this.name = "InvalidExecutionRequestConstruction";
  }
}

const safeReference = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u;
const requestKeys = [
  "schemaVersion",
  "executionId",
  "tenantId",
  "conversationId",
  "actor",
  "correlationId",
  "causationId",
  "conversationVersion",
  "conversationStatus",
  "authorizedCapabilities",
  "delegation",
  "purpose",
  "input",
  "contextEntries",
  "availableTools",
  "inputTokenEstimate",
  "budget",
  "providerPolicy",
] as const;
const actorKeys = ["actorReference", "kind"] as const;
const delegationKeys = ["status", "reference", "issuedForVersion"] as const;
const capabilitySetKeys = ["values"] as const;
const budgetKeys = [
  "maximumInputTokens",
  "maximumOutputTokens",
  "maximumTotalTokens",
  "maximumProviderAttempts",
  "maximumRepairAttempts",
  "maximumFallbacks",
  "maximumCostMicroUnits",
  "maximumContextEntries",
  "maximumToolProposals",
  "remainingConversationTokens",
  "remainingConversationCostMicroUnits",
  "remainingTenantTokens",
  "remainingTenantCostMicroUnits",
  "timeoutMilliseconds",
] as const;
const policyKeys = [
  "candidates",
  "maximumProviderRetries",
  "repairAllowed",
  "fallbackAllowed",
] as const;
const candidateKeys = [
  "providerId",
  "modelId",
  "allowedPurposes",
] as const;

const exactObject = (
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => keys.includes(key))
  );
};

const nonnegativeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const positiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const validateBudget = (budget: ExecutionBudget): void => {
  if (!exactObject(budget, budgetKeys)) {
    throw new InvalidExecutionRequestConstruction("missing_budget");
  }
  const positive = [
    budget.maximumInputTokens,
    budget.maximumOutputTokens,
    budget.maximumTotalTokens,
    budget.maximumProviderAttempts,
    budget.maximumCostMicroUnits,
    budget.remainingConversationTokens,
    budget.remainingConversationCostMicroUnits,
    budget.remainingTenantTokens,
    budget.remainingTenantCostMicroUnits,
    budget.timeoutMilliseconds,
  ];
  const nonnegative = [
    budget.maximumRepairAttempts,
    budget.maximumFallbacks,
    budget.maximumContextEntries,
    budget.maximumToolProposals,
  ];
  if (
    positive.some((value) => !positiveInteger(value)) ||
    nonnegative.some((value) => !nonnegativeInteger(value)) ||
    budget.maximumRepairAttempts > 1 ||
    budget.maximumToolProposals > 1
  ) {
    throw new InvalidExecutionRequestConstruction("invalid_budget");
  }
};

const validatePolicy = (policy: ProviderPolicy): void => {
  if (
    !exactObject(policy, policyKeys) ||
    !Array.isArray(policy.candidates) ||
    policy.candidates.length === 0 ||
    !nonnegativeInteger(policy.maximumProviderRetries) ||
    policy.maximumProviderRetries > 2 ||
    typeof policy.repairAllowed !== "boolean" ||
    typeof policy.fallbackAllowed !== "boolean"
  ) {
    throw new InvalidExecutionRequestConstruction("invalid_provider_policy");
  }
  const candidates = new Set<string>();
  for (const candidate of policy.candidates) {
    if (
      !exactObject(candidate, candidateKeys) ||
      !Array.isArray(candidate.allowedPurposes) ||
      typeof candidate.providerId !== "string" ||
      typeof candidate.modelId !== "string"
    ) {
      throw new InvalidExecutionRequestConstruction("invalid_provider_candidate");
    }
    const key = `${candidate.providerId}:${candidate.modelId}`;
    providerIdentifier(candidate.providerId);
    modelIdentifier(candidate.modelId);
    if (
      candidates.has(key) ||
      candidate.allowedPurposes.length === 0 ||
      candidate.allowedPurposes.some(
        (purpose: string) => executionPurposeDefinition(purpose) === null,
      )
    ) {
      throw new InvalidExecutionRequestConstruction("invalid_provider_candidate");
    }
    candidates.add(key);
  }
};

export const createExecutionRequest = (
  input: ExecutionRequest,
): ExecutionRequest => {
  if (input === null || typeof input !== "object") {
    throw new InvalidExecutionRequestConstruction("missing_request");
  }
  if (!exactObject(input, requestKeys)) {
    throw new InvalidExecutionRequestConstruction("invalid_request_shape");
  }
  if (input.schemaVersion !== 1) {
    throw new InvalidExecutionRequestConstruction("unsupported_schema_version");
  }
  if (
    !exactObject(input.actor, actorKeys) ||
    !exactObject(input.delegation, delegationKeys) ||
    !exactObject(input.authorizedCapabilities, capabilitySetKeys) ||
    !Array.isArray(input.authorizedCapabilities.values) ||
    !Array.isArray(input.contextEntries) ||
    !Array.isArray(input.availableTools) ||
    typeof input.tenantId !== "string" ||
    !safeReference.test(input.tenantId) ||
    typeof input.conversationId !== "string" ||
    !safeReference.test(input.conversationId) ||
    !safeReference.test(input.actor.actorReference) ||
    typeof input.correlationId !== "string" ||
    !safeReference.test(input.correlationId) ||
    (input.causationId !== null &&
      (typeof input.causationId !== "string" ||
        !safeReference.test(input.causationId))) ||
    !actorKinds.includes(input.actor.kind) ||
    !conversationStatuses.includes(input.conversationStatus)
  ) {
    throw new InvalidExecutionRequestConstruction("missing_trusted_identity");
  }
  const purpose = executionPurposeDefinition(input.purpose);
  if (purpose === null) {
    throw new InvalidExecutionRequestConstruction("unsupported_execution_purpose");
  }
  if (
    !positiveInteger(input.conversationVersion) ||
    !nonnegativeInteger(input.inputTokenEstimate)
  ) {
    throw new InvalidExecutionRequestConstruction("invalid_conversation_version");
  }
  executionId(input.executionId);
  if (
    input.actor.kind === "AiAgent" &&
    (input.delegation.status !== "current" ||
      !safeReference.test(input.delegation.reference) ||
      input.delegation.issuedForVersion !== input.conversationVersion)
  ) {
    throw new InvalidExecutionRequestConstruction("stale_or_missing_delegation");
  }
  if (
    input.actor.kind !== "AiAgent" &&
    (input.delegation.status !== "not_required" ||
      input.delegation.reference !== null ||
      input.delegation.issuedForVersion !== null)
  ) {
    throw new InvalidExecutionRequestConstruction("unexpected_delegation");
  }

  validateBudget(input.budget);
  validatePolicy(input.providerPolicy);
  if (
    input.contextEntries.length > input.budget.maximumContextEntries ||
    input.inputTokenEstimate > input.budget.maximumInputTokens ||
    input.inputTokenEstimate > input.budget.maximumTotalTokens ||
    input.inputTokenEstimate > input.budget.remainingConversationTokens ||
    input.inputTokenEstimate > input.budget.remainingTenantTokens
  ) {
    throw new InvalidExecutionRequestConstruction("request_budget_exceeded");
  }

  canonicalRequestFingerprint(input.input);
  for (const entry of input.contextEntries) {
    canonicalRequestFingerprint(entry);
  }
  const authorizedCapabilities = createCapabilitySet(
    input.authorizedCapabilities.values,
  );
  const availableTools = createToolRegistry(input.availableTools).list();

  return deepFreeze({
    ...input,
    actor: { ...input.actor },
    delegation: { ...input.delegation },
    authorizedCapabilities,
    input: cloneCanonicalValue(input.input),
    contextEntries: input.contextEntries.map((entry) =>
      cloneCanonicalValue(entry),
    ),
    availableTools: [...availableTools],
    budget: { ...input.budget },
    providerPolicy: {
      ...input.providerPolicy,
      candidates: input.providerPolicy.candidates.map((candidate) => ({
        ...candidate,
        allowedPurposes: [...candidate.allowedPurposes],
      })),
    },
  });
};
