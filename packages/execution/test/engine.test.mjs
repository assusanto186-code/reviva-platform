import assert from "node:assert/strict";
import test from "node:test";

import {
  createCapabilitySet,
  toolIdentifier,
} from "@reviva/conversation";

import {
  createExecutionEngine,
  InvalidExecutionEngineConfiguration,
  modelIdentifier,
  providerIdentifier,
} from "../dist/index.js";
import {
  bookingPlannerResult,
  bookingRequest,
  budget,
  cancellationTool,
  providerDescriptor,
  providerFailure,
  providerPolicy,
  request,
  requestInput,
  scripted,
  success,
  uncertain,
  usage,
  validPlannerResult,
} from "./fixtures.mjs";

const execute = async (
  responses,
  requestOverrides = {},
  descriptor = providerDescriptor(),
) => {
  const reference = scripted(responses, descriptor);
  const engine = createExecutionEngine({ providers: [reference.provider] });
  return {
    result: await engine.execute(request(requestOverrides)),
    captured: reference.requests(),
  };
};

test("the engine completes a valid structured execution", async () => {
  const { result, captured } = await execute([success()]);
  assert.equal(result.status, "Completed");
  assert.equal(result.plannerResult.patientResponse?.length > 0, true);
  assert.equal(result.usage.providerAttempts, 1);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].modelId, "reference.model");
});

test("identical requests and provider responses produce identical results", async () => {
  const first = await execute([success()]);
  const second = await execute([success()]);
  assert.deepEqual(first.result, second.result);
});

test("execution does not mutate its immutable request", async () => {
  const executionRequest = request();
  const snapshot = structuredClone(executionRequest);
  const reference = scripted([success()]);
  const engine = createExecutionEngine({ providers: [reference.provider] });
  await engine.execute(executionRequest);
  assert.deepEqual(executionRequest, snapshot);
  assert.equal(Object.isFrozen(executionRequest), true);
});

test("a missing required capability is denied before provider invocation", async () => {
  const { result, captured } = await execute(
    [success()],
    { authorizedCapabilities: createCapabilitySet(["conversation.read"]) },
  );
  assert.equal(result.status, "Denied");
  assert.equal(result.failure.code, "CapabilityNotAuthorized");
  assert.equal(captured.length, 0);
});

test("malformed runtime identity returns a correlated typed invalid result", async () => {
  const reference = scripted([success()]);
  const engine = createExecutionEngine({ providers: [reference.provider] });
  const result = await engine.execute(
    requestInput({
      executionId: "",
      correlationId: "",
    }),
  );
  assert.equal(result.status, "InvalidRequest");
  assert.equal(result.executionId, null);
  assert.equal(result.correlationId, null);
  assert.equal(result.failure.code, "InvalidExecutionRequest");
  assert.equal(reference.requests().length, 0);
});

test("handed-off autonomous execution is denied before inference", async () => {
  const { result, captured } = await execute(
    [success()],
    { conversationStatus: "HandedOff" },
  );
  assert.equal(result.status, "Denied");
  assert.equal(result.failure.code, "HandoffRequired");
  assert.equal(captured.length, 0);
});

test("assist-only inference remains available during handoff", async () => {
  const payload = validPlannerResult({
    purpose: "assist_human_operator",
    proposedCapability: null,
    patientResponse: null,
    operatorSummary: "Patient asked to reschedule.",
  });
  const { result } = await execute(
    [success(payload)],
    {
      purpose: "assist_human_operator",
      conversationStatus: "HandedOff",
      authorizedCapabilities: createCapabilitySet(["conversation.read"]),
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["assist_human_operator"],
          },
        ],
      }),
    },
  );
  assert.equal(result.status, "Completed");
});

test("primary provider selection follows policy order", async () => {
  const primary = scripted([success()]);
  const fallback = scripted(
    [success()],
    providerDescriptor({
      providerId: providerIdentifier("reference.secondary"),
      modelIds: [modelIdentifier("reference.secondary-model")],
    }),
  );
  const engine = createExecutionEngine({
    providers: [fallback.provider, primary.provider],
  });
  const result = await engine.execute(
    request({
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["produce_patient_response"],
          },
          {
            providerId: providerIdentifier("reference.secondary"),
            modelId: modelIdentifier("reference.secondary-model"),
            allowedPurposes: ["produce_patient_response"],
          },
        ],
      }),
    }),
  );
  assert.equal(result.status, "Completed");
  assert.equal(primary.requests().length, 1);
  assert.equal(fallback.requests().length, 0);
});

test("purpose-incompatible providers fail closed", async () => {
  const { result, captured } = await execute(
    [success()],
    {
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["summarize_conversation"],
          },
        ],
      }),
    },
  );
  assert.equal(result.status, "Denied");
  assert.equal(result.failure.code, "ProviderNotAllowedForPurpose");
  assert.equal(captured.length, 0);
});

test("unknown providers are rejected before invocation", async () => {
  const { result, captured } = await execute(
    [success()],
    {
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.unknown"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["produce_patient_response"],
          },
        ],
      }),
    },
  );
  assert.equal(result.status, "InvalidRequest");
  assert.equal(result.failure.code, "UnknownProvider");
  assert.equal(captured.length, 0);
});

test("unknown models are rejected before invocation", async () => {
  const { result, captured } = await execute(
    [success()],
    {
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.unknown-model"),
            allowedPurposes: ["produce_patient_response"],
          },
        ],
      }),
    },
  );
  assert.equal(result.status, "InvalidRequest");
  assert.equal(result.failure.code, "UnknownModel");
  assert.equal(captured.length, 0);
});

test("fallback order is deterministic after a definitive failure", async () => {
  const primary = scripted([
    providerFailure("ProviderRejected", false),
  ]);
  const fallback = scripted(
    [success()],
    providerDescriptor({
      providerId: providerIdentifier("reference.secondary"),
      modelIds: [modelIdentifier("reference.secondary-model")],
    }),
  );
  const engine = createExecutionEngine({
    providers: [fallback.provider, primary.provider],
  });
  const result = await engine.execute(
    request({
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["produce_patient_response"],
          },
          {
            providerId: providerIdentifier("reference.secondary"),
            modelId: modelIdentifier("reference.secondary-model"),
            allowedPurposes: ["produce_patient_response"],
          },
        ],
      }),
    }),
  );
  assert.equal(result.status, "Completed");
  assert.equal(result.provenance.providerId, "reference.secondary");
  assert.equal(result.usage.fallbackCount, 1);
});

test("fallback is not used when policy prohibits it", async () => {
  const primary = scripted([
    providerFailure("ProviderRejected", false),
  ]);
  const fallback = scripted(
    [success()],
    providerDescriptor({
      providerId: providerIdentifier("reference.secondary"),
      modelIds: [modelIdentifier("reference.secondary-model")],
    }),
  );
  const engine = createExecutionEngine({
    providers: [primary.provider, fallback.provider],
  });
  const result = await engine.execute(
    request({
      providerPolicy: providerPolicy({
        fallbackAllowed: false,
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["produce_patient_response"],
          },
          {
            providerId: providerIdentifier("reference.secondary"),
            modelId: modelIdentifier("reference.secondary-model"),
            allowedPurposes: ["produce_patient_response"],
          },
        ],
      }),
    }),
  );
  assert.equal(result.status, "ProviderFailed");
  assert.equal(fallback.requests().length, 0);
});

test("malformed initial output is repaired exactly once", async () => {
  const { result, captured } = await execute([
    success({ schemaVersion: 1 }),
    success(),
  ]);
  assert.equal(result.status, "Completed");
  assert.equal(result.usage.repairAttempts, 1);
  assert.equal(captured.length, 2);
  assert.equal(captured[0].repair, null);
  assert.equal(captured[1].repair.attempt, 1);
});

test("failed repair returns typed invalid output and no second repair", async () => {
  const { result, captured } = await execute([
    success({ schemaVersion: 1 }),
    success({ schemaVersion: 1 }),
  ]);
  assert.equal(result.status, "StructuredOutputInvalid");
  assert.equal(result.failure.code, "InvalidStructuredOutput");
  assert.equal(captured.length, 2);
});

test("repair is not a provider retry", async () => {
  const { result } = await execute(
    [success({ schemaVersion: 1 }), success()],
    {
      providerPolicy: providerPolicy({ maximumProviderRetries: 0 }),
    },
  );
  assert.equal(result.status, "Completed");
  assert.equal(result.usage.repairAttempts, 1);
  assert.equal(result.usage.providerAttempts, 2);
});

test("raw unvalidated provider payload never appears in a completed result", async () => {
  const raw = validPlannerResult();
  const { result } = await execute([success(raw)]);
  assert.equal(result.status, "Completed");
  assert.equal("payload" in result, false);
  assert.equal(JSON.stringify(result).includes("hiddenReasoning"), false);
});

test("a transient failure is retried", async () => {
  const { result, captured } = await execute([
    providerFailure(),
    success(),
  ]);
  assert.equal(result.status, "Completed");
  assert.equal(captured.length, 2);
});

test("at most two provider retries are performed", async () => {
  const { result, captured } = await execute([
    providerFailure(),
    providerFailure(),
    providerFailure(),
  ]);
  assert.equal(result.status, "RetryExhausted");
  assert.equal(result.failure.code, "RetryBudgetExhausted");
  assert.equal(captured.length, 3);
});

test("a non-retryable failure is not retried", async () => {
  const { result, captured } = await execute([
    providerFailure("ProviderRejected", false),
  ]);
  assert.equal(result.status, "ProviderFailed");
  assert.equal(captured.length, 1);
});

test("a pre-acceptance timeout can be retried safely", async () => {
  const { result, captured } = await execute([
    providerFailure("ProviderTimedOut", true, false),
    success(),
  ]);
  assert.equal(result.status, "Completed");
  assert.equal(captured.length, 2);
});

test("a timeout after possible acceptance requires reconciliation", async () => {
  const { result, captured } = await execute([
    providerFailure("ProviderTimedOut", true, true),
  ]);
  assert.equal(result.status, "ReconciliationRequired");
  assert.equal(
    result.reconciliation.uncertainty,
    "timeout_after_possible_acceptance",
  );
  assert.equal(captured.length, 1);
});

test("explicit provider uncertainty is never retried blindly", async () => {
  const { result, captured } = await execute([
    uncertain("cancelled_completion_unknown"),
  ]);
  assert.equal(result.status, "ReconciliationRequired");
  assert.equal(
    result.reconciliation.uncertainty,
    "cancelled_completion_unknown",
  );
  assert.equal(captured.length, 1);
});

test("output-token ceiling rejects reported overage", async () => {
  const { result } = await execute(
    [success(validPlannerResult(), { usage: usage({ outputTokens: 5, totalTokens: 15 }) })],
    {
      budget: budget({
        maximumInputTokens: 100,
        maximumOutputTokens: 4,
        maximumTotalTokens: 104,
      }),
    },
  );
  assert.equal(result.status, "BudgetExceeded");
});

test("total-token ceiling rejects reported overage", async () => {
  const { result } = await execute(
    [success(validPlannerResult(), { usage: usage({ inputTokens: 15, outputTokens: 15, totalTokens: 30 }) })],
    {
      inputTokenEstimate: 5,
      budget: budget({
        maximumInputTokens: 15,
        maximumOutputTokens: 15,
        maximumTotalTokens: 25,
      }),
    },
  );
  assert.equal(result.status, "BudgetExceeded");
});

test("provider-attempt ceiling stops before an extra call", async () => {
  const { result, captured } = await execute(
    [providerFailure()],
    { budget: budget({ maximumProviderAttempts: 1 }) },
  );
  assert.equal(result.status, "BudgetExceeded");
  assert.equal(captured.length, 1);
});

test("repair ceiling stops before a repair call", async () => {
  const { result, captured } = await execute(
    [success({ schemaVersion: 1 })],
    { budget: budget({ maximumRepairAttempts: 0 }) },
  );
  assert.equal(result.status, "BudgetExceeded");
  assert.equal(result.failure.code, "RepairBudgetExhausted");
  assert.equal(captured.length, 1);
});

test("fallback ceiling prevents the next provider call", async () => {
  const primary = scripted([
    providerFailure("ProviderRejected", false),
  ]);
  const fallback = scripted(
    [success()],
    providerDescriptor({
      providerId: providerIdentifier("reference.secondary"),
      modelIds: [modelIdentifier("reference.secondary-model")],
    }),
  );
  const engine = createExecutionEngine({
    providers: [primary.provider, fallback.provider],
  });
  const result = await engine.execute(
    request({
      budget: budget({ maximumFallbacks: 0 }),
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["produce_patient_response"],
          },
          {
            providerId: providerIdentifier("reference.secondary"),
            modelId: modelIdentifier("reference.secondary-model"),
            allowedPurposes: ["produce_patient_response"],
          },
        ],
      }),
    }),
  );
  assert.equal(result.status, "ProviderFailed");
  assert.equal(fallback.requests().length, 0);
});

test("cost ceiling rejects provider-reported overage", async () => {
  const { result } = await execute(
    [success(validPlannerResult(), { usage: usage({ costMicroUnits: 26 }) })],
    { budget: budget({ maximumCostMicroUnits: 25 }) },
  );
  assert.equal(result.status, "BudgetExceeded");
});

test("invalid provider usage is a malformed provider response", async () => {
  const { result } = await execute([
    success(validPlannerResult(), {
      usage: usage({ totalTokens: 999 }),
    }),
  ]);
  assert.equal(result.status, "ProviderFailed");
  assert.equal(result.failure.code, "MalformedProviderResponse");
});

test("a registered booking proposal is returned without execution", async () => {
  const reference = scripted([success(bookingPlannerResult())]);
  const engine = createExecutionEngine({ providers: [reference.provider] });
  const result = await engine.execute(bookingRequest());
  assert.equal(result.status, "Completed");
  assert.equal(result.toolProposal.toolIdentifier, "booking.create");
  assert.match(result.toolProposal.effectDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(
    Object.keys(result.toolProposal).sort(),
    [
      "arguments",
      "confirmationStatus",
      "correlationId",
      "effectDigest",
      "humanApprovalStatus",
      "requiredCapability",
      "schemaVersion",
      "sourceExecutionId",
      "toolIdentifier",
      "toolVersion",
    ].sort(),
  );
  assert.equal(
    Object.values(result.toolProposal).some(
      (value) => typeof value === "function",
    ),
    false,
  );
});

test("tool effect digest is deterministic", async () => {
  const firstProvider = scripted([success(bookingPlannerResult())]);
  const secondProvider = scripted([success(bookingPlannerResult())]);
  const first = await createExecutionEngine({
    providers: [firstProvider.provider],
  }).execute(bookingRequest());
  const second = await createExecutionEngine({
    providers: [secondProvider.provider],
  }).execute(bookingRequest());
  assert.equal(first.status, "Completed");
  assert.equal(second.status, "Completed");
  assert.equal(first.toolProposal.effectDigest, second.toolProposal.effectDigest);
});

test("human approval requirements are represented but never granted", async () => {
  const tool = cancellationTool();
  const payload = validPlannerResult({
    purpose: "propose_cancellation_request",
    proposedCapability: "booking.cancel.request",
    patientResponse: null,
    proposedTool: {
      identifier: toolIdentifier("booking.cancel"),
      version: "1",
      arguments: { bookingReference: "booking-fixture" },
      confirmationStatus: "not_required",
      humanApprovalStatus: "required",
    },
  });
  const reference = scripted([success(payload)]);
  const engine = createExecutionEngine({ providers: [reference.provider] });
  const result = await engine.execute(
    request({
      purpose: "propose_cancellation_request",
      authorizedCapabilities: createCapabilitySet([
        "booking.cancel.request",
      ]),
      availableTools: [tool],
      providerPolicy: providerPolicy({
        candidates: [
          {
            providerId: providerIdentifier("reference.primary"),
            modelId: modelIdentifier("reference.model"),
            allowedPurposes: ["propose_cancellation_request"],
          },
        ],
      }),
    }),
  );
  assert.equal(result.status, "Completed");
  assert.equal(result.toolProposal.humanApprovalStatus, "required");
});

test("provider adapter exceptions fail closed without leaking an exception", async () => {
  const provider = {
    descriptor: providerDescriptor(),
    async infer() {
      throw new Error("unsafe adapter detail");
    },
  };
  const result = await createExecutionEngine({ providers: [provider] }).execute(
    request(),
  );
  assert.equal(result.status, "ProviderFailed");
  assert.equal(result.failure.code, "MalformedProviderResponse");
  assert.equal(JSON.stringify(result).includes("unsafe adapter detail"), false);
});

test("malformed provider response values fail closed", async () => {
  const provider = {
    descriptor: providerDescriptor(),
    async infer() {
      return undefined;
    },
  };
  const result = await createExecutionEngine({ providers: [provider] }).execute(
    request(),
  );
  assert.equal(result.status, "ProviderFailed");
  assert.equal(result.failure.code, "MalformedProviderResponse");
});

test("engine construction rejects duplicate provider identifiers", () => {
  const first = scripted([success()]);
  const second = scripted([success()]);
  assert.throws(
    () =>
      createExecutionEngine({
        providers: [first.provider, second.provider],
      }),
    (error) =>
      error instanceof InvalidExecutionEngineConfiguration &&
      error.reason === "duplicate_provider",
  );
});

test("engine snapshots provider descriptors against later mutation", async () => {
  const descriptor = {
    ...providerDescriptor(),
    modelIds: [...providerDescriptor().modelIds],
  };
  const provider = {
    descriptor,
    async infer() {
      return success();
    },
  };
  const engine = createExecutionEngine({ providers: [provider] });
  descriptor.modelIds.splice(0, 1);
  const result = await engine.execute(request());
  assert.equal(result.status, "Completed");
});
