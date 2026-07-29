import {
  autonomousAiForbiddenStatuses,
  capabilitySetHas,
  correlationId as conversationCorrelationId,
} from "@reviva/conversation";

import type {
  AIProvider,
  ExecutionEngine,
  ExecutionFailure,
  ExecutionFailureCode,
  ExecutionRequest,
  ExecutionResult,
  PlannerResult,
  ProviderCandidate,
  ProviderDescriptor,
  ProviderFailure,
  ProviderRequest,
  ProviderResponse,
  ProviderUsage,
  StructuredOutputSchema,
  ToolProposal,
  UsageSummary,
} from "./contracts.js";
import type {
  ModelIdentifier,
  ProviderIdentifier,
} from "./identifiers.js";
import {
  executionId as executionIdentifier,
  modelIdentifier,
  providerIdentifier,
  providerRequestIdentifier,
  schemaIdentifier,
} from "./identifiers.js";
import { deepFreeze } from "./internal/immutable.js";
import { executionPurposeDefinition } from "./purposes.js";
import { createExecutionRequest } from "./request.js";
import {
  createToolProposal,
  plannerOutputSchema,
} from "./structured-output.js";

export type CreateExecutionEngineInput = Readonly<{
  providers: readonly AIProvider[];
  outputSchema?: StructuredOutputSchema<PlannerResult>;
}>;

export class InvalidExecutionEngineConfiguration extends Error {
  readonly code = "InvalidExecutionEngineConfiguration" as const;

  constructor(readonly reason: string) {
    super("Execution engine configuration is invalid.");
    this.name = "InvalidExecutionEngineConfiguration";
  }
}

type MutableUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costMicroUnits: number;
  providerAttempts: number;
  repairAttempts: number;
  fallbackCount: number;
};

type SelectedProvider = Readonly<{
  provider: AIProvider;
  candidate: ProviderCandidate;
}>;

const emptyUsage = (): MutableUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  costMicroUnits: 0,
  providerAttempts: 0,
  repairAttempts: 0,
  fallbackCount: 0,
});

const freezeUsage = (usage: MutableUsage): UsageSummary =>
  deepFreeze({ ...usage });

const failure = (
  code: ExecutionFailureCode,
  safeReason: string,
): ExecutionFailure => deepFreeze({ code, safeReason });

const failedResult = (
  request: ExecutionRequest,
  usage: MutableUsage,
  status:
    | "Denied"
    | "InvalidRequest"
    | "StructuredOutputInvalid"
    | "ProviderFailed"
    | "BudgetExceeded"
    | "RetryExhausted",
  code: ExecutionFailureCode,
  safeReason: string,
): ExecutionResult =>
  deepFreeze({
    status,
    executionId: request.executionId,
    failure: failure(code, safeReason),
    usage: freezeUsage(usage),
    correlationId: request.correlationId,
  });

const invalidRequestResult = (
  input: unknown,
  usage: MutableUsage,
): ExecutionResult => {
  let safeExecutionId = null;
  let safeCorrelationId = null;
  if (input !== null && typeof input === "object") {
    const candidate = input as Record<string, unknown>;
    if (typeof candidate.executionId === "string") {
      try {
        safeExecutionId = executionIdentifier(candidate.executionId);
      } catch {
        safeExecutionId = null;
      }
    }
    if (typeof candidate.correlationId === "string") {
      try {
        safeCorrelationId = conversationCorrelationId(
          candidate.correlationId,
        );
      } catch {
        safeCorrelationId = null;
      }
    }
  }
  return deepFreeze({
    status: "InvalidRequest",
    executionId: safeExecutionId,
    failure: failure(
      "InvalidExecutionRequest",
      "execution_request_invalid",
    ),
    usage: freezeUsage(usage),
    correlationId: safeCorrelationId,
  });
};

const validReportedUsage = (usage: ProviderUsage): boolean =>
  Number.isSafeInteger(usage.inputTokens) &&
  usage.inputTokens >= 0 &&
  Number.isSafeInteger(usage.outputTokens) &&
  usage.outputTokens >= 0 &&
  Number.isSafeInteger(usage.totalTokens) &&
  usage.totalTokens === usage.inputTokens + usage.outputTokens &&
  Number.isSafeInteger(usage.costMicroUnits) &&
  usage.costMicroUnits >= 0;

const addUsageWithinBudget = (
  request: ExecutionRequest,
  aggregate: MutableUsage,
  reported: ProviderUsage,
): boolean => {
  if (!validReportedUsage(reported)) return false;
  const inputTokens = aggregate.inputTokens + reported.inputTokens;
  const outputTokens = aggregate.outputTokens + reported.outputTokens;
  const totalTokens = aggregate.totalTokens + reported.totalTokens;
  const costMicroUnits = aggregate.costMicroUnits + reported.costMicroUnits;
  if (
    inputTokens > request.budget.maximumInputTokens ||
    outputTokens > request.budget.maximumOutputTokens ||
    totalTokens > request.budget.maximumTotalTokens ||
    totalTokens > request.budget.remainingConversationTokens ||
    totalTokens > request.budget.remainingTenantTokens ||
    costMicroUnits > request.budget.maximumCostMicroUnits ||
    costMicroUnits > request.budget.remainingConversationCostMicroUnits ||
    costMicroUnits > request.budget.remainingTenantCostMicroUnits
  ) {
    return false;
  }
  aggregate.inputTokens = inputTokens;
  aggregate.outputTokens = outputTokens;
  aggregate.totalTokens = totalTokens;
  aggregate.costMicroUnits = costMicroUnits;
  return true;
};

const validationFailure = (
  failures: readonly string[],
): Readonly<{
  status: "Denied" | "StructuredOutputInvalid";
  code: ExecutionFailureCode;
  reason: string;
}> => {
  if (failures.includes("capability_not_authorized")) {
    return {
      status: "Denied",
      code: "CapabilityNotAuthorized",
      reason: "planner_capability_not_authorized",
    };
  }
  if (failures.includes("tool_not_registered")) {
    return {
      status: "StructuredOutputInvalid",
      code: "ToolNotRegistered",
      reason: "planner_tool_not_registered",
    };
  }
  if (failures.includes("tool_capability_mismatch")) {
    return {
      status: "StructuredOutputInvalid",
      code: "ToolCapabilityMismatch",
      reason: "planner_tool_capability_mismatch",
    };
  }
  if (failures.includes("confirmation_status_mismatch")) {
    return {
      status: "StructuredOutputInvalid",
      code: "ConfirmationRequired",
      reason: "planner_confirmation_status_invalid",
    };
  }
  if (failures.includes("human_approval_status_mismatch")) {
    return {
      status: "StructuredOutputInvalid",
      code: "HumanApprovalRequired",
      reason: "planner_human_approval_status_invalid",
    };
  }
  if (failures.includes("tool_proposal_not_allowed")) {
    return {
      status: "StructuredOutputInvalid",
      code: "ToolProposalNotAllowed",
      reason: "tool_proposal_not_allowed_for_purpose",
    };
  }
  if (failures.includes("unsupported_schema_version")) {
    return {
      status: "StructuredOutputInvalid",
      code: "UnsupportedSchemaVersion",
      reason: "planner_schema_version_unsupported",
    };
  }
  return {
    status: "StructuredOutputInvalid",
    code: "InvalidStructuredOutput",
    reason: "planner_output_failed_validation",
  };
};

const buildProviderRequest = (
  request: ExecutionRequest,
  schema: StructuredOutputSchema<PlannerResult>,
  modelId: ModelIdentifier,
  repair: ProviderRequest["repair"],
): ProviderRequest =>
  deepFreeze({
    schemaVersion: 1,
    executionId: request.executionId,
    tenantId: request.tenantId,
    conversationId: request.conversationId,
    purpose: request.purpose,
    modelId,
    input: request.input,
    contextEntries: request.contextEntries,
    outputContract: schema.contract,
    timeoutMilliseconds: request.budget.timeoutMilliseconds,
    maximumOutputTokens: request.budget.maximumOutputTokens,
    correlationId: request.correlationId,
    causationId: request.causationId,
    repair,
  });

const uncertainResult = (
  request: ExecutionRequest,
  usage: MutableUsage,
  selected: SelectedProvider,
  response: Extract<ProviderResponse, { kind: "uncertain" }>,
): ExecutionResult =>
  deepFreeze({
    status: "ReconciliationRequired",
    executionId: request.executionId,
    reconciliation: {
      executionId: request.executionId,
      tenantId: request.tenantId,
      conversationId: request.conversationId,
      providerId: selected.candidate.providerId,
      modelId: selected.candidate.modelId,
      providerRequestId: response.providerRequestId,
      uncertainty: response.uncertainty,
      correlationId: request.correlationId,
    },
    usage: freezeUsage(usage),
    correlationId: request.correlationId,
  });

const acceptedTimeoutAsUncertain = (
  response: Extract<ProviderResponse, { kind: "failure" }>,
): Extract<ProviderResponse, { kind: "uncertain" }> | null =>
  response.failure.code === "ProviderTimedOut" &&
  response.failure.requestAccepted
    ? {
        kind: "uncertain",
        uncertainty: "timeout_after_possible_acceptance",
        providerRequestId: null,
      }
    : null;

const providerFailureCode = (
  providerFailure: ProviderFailure,
): ExecutionFailureCode => providerFailure.code;

const completeResult = (
  request: ExecutionRequest,
  usage: MutableUsage,
  selected: SelectedProvider,
  response: Extract<ProviderResponse, { kind: "success" }>,
  plannerResult: PlannerResult,
  toolProposal: ToolProposal | null,
): ExecutionResult => {
  const common = {
    executionId: request.executionId,
    plannerResult,
    usage: freezeUsage(usage),
    provenance: {
      providerId: selected.candidate.providerId,
      modelId: selected.candidate.modelId,
      providerRequestId: response.providerRequestId,
    },
    correlationId: request.correlationId,
  };
  if (plannerResult.escalation === "recommend_handoff") {
    return deepFreeze({ status: "HandoffRecommended", ...common });
  }
  return deepFreeze({
    status: "Completed",
    ...common,
    toolProposal,
  });
};

const invoke = async (
  selected: SelectedProvider,
  request: ProviderRequest,
  usage: MutableUsage,
): Promise<ProviderResponse> => {
  usage.providerAttempts += 1;
  try {
    const response: unknown = await selected.provider.infer(
      request,
      selected.candidate.modelId,
    );
    if (response === null || typeof response !== "object") {
      throw new Error("invalid_provider_response");
    }
    const candidate = response as Record<string, unknown>;
    if (candidate.kind === "success") {
      if (
        !["completed", "length_limited"].includes(
          String(candidate.finishStatus),
        ) ||
        candidate.usage === null ||
        typeof candidate.usage !== "object" ||
        (candidate.providerRequestId !== null &&
          typeof candidate.providerRequestId !== "string")
      ) {
        throw new Error("invalid_provider_success");
      }
      if (typeof candidate.providerRequestId === "string") {
        providerRequestIdentifier(candidate.providerRequestId);
      }
      return response as ProviderResponse;
    }
    if (candidate.kind === "failure") {
      const providerFailure = candidate.failure;
      if (
        providerFailure === null ||
        typeof providerFailure !== "object" ||
        ![
          "ProviderUnavailable",
          "ProviderRateLimited",
          "ProviderTimedOut",
          "ProviderRejected",
          "MalformedProviderResponse",
        ].includes(String((providerFailure as Record<string, unknown>).code)) ||
        typeof (providerFailure as Record<string, unknown>).retryable !==
          "boolean" ||
        typeof (providerFailure as Record<string, unknown>).requestAccepted !==
          "boolean" ||
        typeof (providerFailure as Record<string, unknown>).safeReason !==
          "string"
      ) {
        throw new Error("invalid_provider_failure");
      }
      return response as ProviderResponse;
    }
    if (candidate.kind === "uncertain") {
      if (
        ![
          "timeout_after_possible_acceptance",
          "provider_status_unknown",
          "cancelled_completion_unknown",
        ].includes(String(candidate.uncertainty)) ||
        (candidate.providerRequestId !== null &&
          typeof candidate.providerRequestId !== "string")
      ) {
        throw new Error("invalid_provider_uncertainty");
      }
      if (typeof candidate.providerRequestId === "string") {
        providerRequestIdentifier(candidate.providerRequestId);
      }
      return response as ProviderResponse;
    }
    throw new Error("unknown_provider_response");
  } catch {
    return deepFreeze({
      kind: "failure",
      failure: {
        code: "MalformedProviderResponse",
        retryable: false,
        requestAccepted: false,
        safeReason: "provider_adapter_contract_failure",
      },
    });
  }
};

const canInvoke = (
  request: ExecutionRequest,
  usage: MutableUsage,
): boolean => usage.providerAttempts < request.budget.maximumProviderAttempts;

const snapshotProvider = (provider: AIProvider): AIProvider => {
  if (
    provider === null ||
    typeof provider !== "object" ||
    provider.descriptor === null ||
    typeof provider.descriptor !== "object" ||
    typeof provider.infer !== "function"
  ) {
    throw new InvalidExecutionEngineConfiguration("invalid_provider");
  }
  const descriptor = provider.descriptor as ProviderDescriptor;
  const descriptorKeys = [
    "providerId",
    "modelIds",
    "supportedPurposes",
    "capabilities",
  ];
  if (
    Object.keys(descriptor).length !== descriptorKeys.length ||
    Object.keys(descriptor).some((key) => !descriptorKeys.includes(key)) ||
    !Array.isArray(descriptor.modelIds) ||
    descriptor.modelIds.length === 0 ||
    !Array.isArray(descriptor.supportedPurposes) ||
    descriptor.supportedPurposes.length === 0 ||
    !Array.isArray(descriptor.capabilities) ||
    descriptor.capabilities.length === 0 ||
    descriptor.capabilities.some(
      (capability) =>
        capability !== "structured_output" && capability !== "repair",
    )
  ) {
    throw new InvalidExecutionEngineConfiguration(
      "invalid_provider_descriptor",
    );
  }
  providerIdentifier(descriptor.providerId);
  for (const modelId of descriptor.modelIds) modelIdentifier(modelId);
  if (
    new Set(descriptor.modelIds).size !== descriptor.modelIds.length ||
    new Set(descriptor.supportedPurposes).size !==
      descriptor.supportedPurposes.length ||
    new Set(descriptor.capabilities).size !== descriptor.capabilities.length ||
    descriptor.supportedPurposes.some(
      (purpose) => executionPurposeDefinition(purpose) === null,
    )
  ) {
    throw new InvalidExecutionEngineConfiguration(
      "invalid_provider_descriptor",
    );
  }
  return Object.freeze({
    descriptor: deepFreeze({
      providerId: descriptor.providerId,
      modelIds: [...descriptor.modelIds],
      supportedPurposes: [...descriptor.supportedPurposes],
      capabilities: [...descriptor.capabilities],
    }),
    infer: provider.infer.bind(provider),
  });
};

export const createExecutionEngine = (
  input: CreateExecutionEngineInput,
): ExecutionEngine => {
  if (
    input === null ||
    typeof input !== "object" ||
    !Array.isArray(input.providers) ||
    input.providers.length === 0
  ) {
    throw new InvalidExecutionEngineConfiguration("missing_providers");
  }
  const providers = new Map<ProviderIdentifier, AIProvider>();
  for (const candidate of input.providers) {
    const provider = snapshotProvider(candidate);
    if (providers.has(provider.descriptor.providerId)) {
      throw new InvalidExecutionEngineConfiguration("duplicate_provider");
    }
    providers.set(provider.descriptor.providerId, provider);
  }
  const schema = input.outputSchema ?? plannerOutputSchema;
  if (
    schema === null ||
    typeof schema !== "object" ||
    typeof schema.validate !== "function" ||
    schema.contract.schemaVersion !== 1 ||
    schema.contract.unknownFields !== "reject"
  ) {
    throw new InvalidExecutionEngineConfiguration("invalid_output_schema");
  }
  schemaIdentifier(schema.contract.schemaId);

  return Object.freeze({
    async execute(untrustedRequest: ExecutionRequest): Promise<ExecutionResult> {
      const usage = emptyUsage();
      let request: ExecutionRequest;
      try {
        request = createExecutionRequest(untrustedRequest);
      } catch {
        return invalidRequestResult(untrustedRequest, usage);
      }

      const purpose = executionPurposeDefinition(request.purpose);
      if (purpose === null) {
        return failedResult(
          request,
          usage,
          "InvalidRequest",
          "UnsupportedExecutionPurpose",
          "execution_purpose_unsupported",
        );
      }
      if (
        !capabilitySetHas(
          request.authorizedCapabilities,
          purpose.requiredCapability,
        )
      ) {
        return failedResult(
          request,
          usage,
          "Denied",
          "CapabilityNotAuthorized",
          "required_capability_not_authorized",
        );
      }
      if (
        request.actor.kind === "AiAgent" &&
        autonomousAiForbiddenStatuses.includes(
          request.conversationStatus as (typeof autonomousAiForbiddenStatuses)[number],
        ) &&
        request.purpose !== "assist_human_operator"
      ) {
        return failedResult(
          request,
          usage,
          "Denied",
          "HandoffRequired",
          "conversation_requires_human_control",
        );
      }

      const selectedProviders: SelectedProvider[] = [];
      for (const candidate of request.providerPolicy.candidates) {
        const provider = providers.get(candidate.providerId);
        if (provider === undefined) {
          return failedResult(
            request,
            usage,
            "InvalidRequest",
            "UnknownProvider",
            "provider_not_registered",
          );
        }
        if (!provider.descriptor.modelIds.includes(candidate.modelId)) {
          return failedResult(
            request,
            usage,
            "InvalidRequest",
            "UnknownModel",
            "model_not_registered_for_provider",
          );
        }
        if (
          !candidate.allowedPurposes.includes(request.purpose) ||
          !provider.descriptor.supportedPurposes.includes(request.purpose)
        ) {
          return failedResult(
            request,
            usage,
            "Denied",
            "ProviderNotAllowedForPurpose",
            "provider_not_allowed_for_purpose",
          );
        }
        if (!provider.descriptor.capabilities.includes("structured_output")) {
          return failedResult(
            request,
            usage,
            "InvalidRequest",
            "InvalidProviderPolicy",
            "provider_lacks_structured_output_capability",
          );
        }
        selectedProviders.push({ provider, candidate });
      }

      let providerRetries = 0;
      let lastFailure: ProviderFailure | null = null;
      for (
        let candidateIndex = 0;
        candidateIndex < selectedProviders.length;
        candidateIndex += 1
      ) {
        const selected = selectedProviders[candidateIndex];
        if (selected === undefined) continue;
        if (candidateIndex > 0) {
          if (
            !request.providerPolicy.fallbackAllowed ||
            usage.fallbackCount >= request.budget.maximumFallbacks
          ) {
            break;
          }
          usage.fallbackCount += 1;
        }

        for (let boundedAttempt = 0; boundedAttempt < 3; boundedAttempt += 1) {
          if (!canInvoke(request, usage)) {
            return failedResult(
              request,
              usage,
              "BudgetExceeded",
              "ExecutionBudgetExceeded",
              "provider_attempt_budget_exceeded",
            );
          }
          const response = await invoke(
            selected,
            buildProviderRequest(
              request,
              schema,
              selected.candidate.modelId,
              null,
            ),
            usage,
          );
          if (response.kind === "uncertain") {
            return uncertainResult(request, usage, selected, response);
          }
          if (response.kind === "failure") {
            const uncertain = acceptedTimeoutAsUncertain(response);
            if (uncertain !== null) {
              return uncertainResult(request, usage, selected, uncertain);
            }
            lastFailure = response.failure;
            if (
              response.failure.retryable &&
              providerRetries <
                Math.min(request.providerPolicy.maximumProviderRetries, 2)
            ) {
              if (!canInvoke(request, usage)) {
                return failedResult(
                  request,
                  usage,
                  "BudgetExceeded",
                  "ExecutionBudgetExceeded",
                  "provider_attempt_budget_exceeded",
                );
              }
              providerRetries += 1;
              continue;
            }
            break;
          }

          if (!validReportedUsage(response.usage)) {
            return failedResult(
              request,
              usage,
              "ProviderFailed",
              "MalformedProviderResponse",
              "provider_reported_usage_invalid",
            );
          }
          if (!addUsageWithinBudget(request, usage, response.usage)) {
            return failedResult(
              request,
              usage,
              "BudgetExceeded",
              "ExecutionBudgetExceeded",
              "provider_reported_usage_exceeded_budget",
            );
          }
          const initialValidation =
            response.finishStatus === "completed"
              ? schema.validate(response.payload, request)
              : {
                  valid: false as const,
                  failures: ["incomplete_provider_output"],
                };
          if (initialValidation.valid) {
            const proposal = createToolProposal(
              request,
              initialValidation.value,
            );
            if (
              proposal !== null &&
              request.budget.maximumToolProposals < 1
            ) {
              return failedResult(
                request,
                usage,
                "BudgetExceeded",
                "ExecutionBudgetExceeded",
                "tool_proposal_budget_exceeded",
              );
            }
            return completeResult(
              request,
              usage,
              selected,
              response,
              initialValidation.value,
              proposal,
            );
          }

          if (
            !request.providerPolicy.repairAllowed ||
            !selected.provider.descriptor.capabilities.includes("repair")
          ) {
            const mapped = validationFailure(initialValidation.failures);
            return failedResult(
              request,
              usage,
              mapped.status,
              mapped.code,
              mapped.reason,
            );
          }
          if (
            request.budget.maximumRepairAttempts < 1 ||
            usage.repairAttempts >= request.budget.maximumRepairAttempts
          ) {
            return failedResult(
              request,
              usage,
              "BudgetExceeded",
              "RepairBudgetExhausted",
              "structured_output_repair_budget_exhausted",
            );
          }
          if (!canInvoke(request, usage)) {
            return failedResult(
              request,
              usage,
              "BudgetExceeded",
              "ExecutionBudgetExceeded",
              "provider_attempt_budget_exceeded_before_repair",
            );
          }

          usage.repairAttempts += 1;
          const repaired = await invoke(
            selected,
            buildProviderRequest(
              request,
              schema,
              selected.candidate.modelId,
              {
                attempt: 1,
                validationFailures: initialValidation.failures,
              },
            ),
            usage,
          );
          if (repaired.kind === "uncertain") {
            return uncertainResult(request, usage, selected, repaired);
          }
          if (repaired.kind === "failure") {
            const uncertain = acceptedTimeoutAsUncertain(repaired);
            if (uncertain !== null) {
              return uncertainResult(request, usage, selected, uncertain);
            }
            lastFailure = repaired.failure;
            break;
          }
          if (!validReportedUsage(repaired.usage)) {
            return failedResult(
              request,
              usage,
              "ProviderFailed",
              "MalformedProviderResponse",
              "provider_reported_usage_invalid",
            );
          }
          if (!addUsageWithinBudget(request, usage, repaired.usage)) {
            return failedResult(
              request,
              usage,
              "BudgetExceeded",
              "ExecutionBudgetExceeded",
              "repair_usage_exceeded_budget",
            );
          }
          const repairedValidation =
            repaired.finishStatus === "completed"
              ? schema.validate(repaired.payload, request)
              : {
                  valid: false as const,
                  failures: ["incomplete_provider_output"],
                };
          if (!repairedValidation.valid) {
            const mapped = validationFailure(repairedValidation.failures);
            return failedResult(
              request,
              usage,
              mapped.status,
              mapped.code,
              mapped.reason,
            );
          }
          const proposal = createToolProposal(
            request,
            repairedValidation.value,
          );
          if (proposal !== null && request.budget.maximumToolProposals < 1) {
            return failedResult(
              request,
              usage,
              "BudgetExceeded",
              "ExecutionBudgetExceeded",
              "tool_proposal_budget_exceeded",
            );
          }
          return completeResult(
            request,
            usage,
            selected,
            repaired,
            repairedValidation.value,
            proposal,
          );
        }
      }

      if (
        lastFailure?.retryable &&
        providerRetries >=
          Math.min(request.providerPolicy.maximumProviderRetries, 2)
      ) {
        return failedResult(
          request,
          usage,
          "RetryExhausted",
          "RetryBudgetExhausted",
          "provider_retry_budget_exhausted",
        );
      }
      return failedResult(
        request,
        usage,
        "ProviderFailed",
        lastFailure === null
          ? "ProviderUnavailable"
          : providerFailureCode(lastFailure),
        lastFailure === null
          ? "no_provider_completed_execution"
          : "provider_failed_definitively",
      );
    },
  });
};
