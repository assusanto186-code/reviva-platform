import {
  causationId,
  conversationId,
  correlationId,
  createCapabilitySet,
  toolIdentifier,
} from "@reviva/conversation";

import {
  createExecutionRequest,
  executionId,
  modelIdentifier,
  providerIdentifier,
  providerRequestIdentifier,
} from "../dist/index.js";
import {
  createScriptedProvider,
} from "../dist/reference/scripted-provider.js";

export const validPlannerResult = (overrides = {}) => ({
  schemaVersion: 1,
  purpose: "produce_patient_response",
  proposedCapability: "conversation.respond",
  proposedTool: null,
  confidenceBand: "high",
  patientResponse: "How may I help with your appointment?",
  operatorSummary: null,
  escalation: "none",
  reasonCodes: ["response.ready"],
  ...overrides,
});

export const usage = (overrides = {}) => ({
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
  costMicroUnits: 25,
  ...overrides,
});

export const success = (
  payload = validPlannerResult(),
  overrides = {},
) => ({
  kind: "success",
  payload,
  finishStatus: "completed",
  usage: usage(),
  providerRequestId: providerRequestIdentifier("request.reference"),
  ...overrides,
});

export const providerFailure = (
  code = "ProviderUnavailable",
  retryable = true,
  requestAccepted = false,
) => ({
  kind: "failure",
  failure: {
    code,
    retryable,
    requestAccepted,
    safeReason: "scripted_provider_failure",
  },
});

export const uncertain = (
  uncertainty = "provider_status_unknown",
) => ({
  kind: "uncertain",
  uncertainty,
  providerRequestId: providerRequestIdentifier("request.uncertain"),
});

export const providerDescriptor = (overrides = {}) => ({
  providerId: providerIdentifier("reference.primary"),
  modelIds: [modelIdentifier("reference.model")],
  supportedPurposes: [
    "classify_intent",
    "produce_patient_response",
    "propose_booking_action",
    "propose_booking_modification",
    "propose_cancellation_request",
    "propose_reactivation_action",
    "summarize_conversation",
    "assist_human_operator",
    "extract_structured_facts",
  ],
  capabilities: ["structured_output", "repair"],
  ...overrides,
});

export const scripted = (
  responses,
  descriptor = providerDescriptor(),
) => createScriptedProvider(descriptor, responses);

export const bookingTool = (overrides = {}) => ({
  identifier: toolIdentifier("booking.create"),
  name: "booking.create",
  version: "1",
  description: "Proposes creation of a confirmed booking.",
  requiredCapability: "booking.create",
  allowedActorKinds: ["AiAgent", "Staff", "HumanOperator"],
  confirmation: "required",
  humanApproval: "never",
  effect: "mutating",
  inputContract: "booking.create.input.v1",
  outputContract: "booking.create.output.v1",
  ...overrides,
});

export const cancellationTool = (overrides = {}) =>
  bookingTool({
    identifier: toolIdentifier("booking.cancel"),
    name: "booking.cancel",
    requiredCapability: "booking.cancel.request",
    confirmation: "never",
    humanApproval: "required",
    ...overrides,
  });

export const budget = (overrides = {}) => ({
  maximumInputTokens: 100,
  maximumOutputTokens: 100,
  maximumTotalTokens: 200,
  maximumProviderAttempts: 6,
  maximumRepairAttempts: 1,
  maximumFallbacks: 1,
  maximumCostMicroUnits: 1_000,
  maximumContextEntries: 4,
  maximumToolProposals: 1,
  remainingConversationTokens: 1_000,
  remainingConversationCostMicroUnits: 10_000,
  remainingTenantTokens: 10_000,
  remainingTenantCostMicroUnits: 100_000,
  timeoutMilliseconds: 5_000,
  ...overrides,
});

export const providerPolicy = (overrides = {}) => ({
  candidates: [
    {
      providerId: providerIdentifier("reference.primary"),
      modelId: modelIdentifier("reference.model"),
      allowedPurposes: ["produce_patient_response"],
    },
  ],
  maximumProviderRetries: 2,
  repairAllowed: true,
  fallbackAllowed: true,
  ...overrides,
});

export const requestInput = (overrides = {}) => ({
  schemaVersion: 1,
  executionId: executionId("execution.fixture"),
  tenantId: "tenant-fixture",
  conversationId: conversationId("conversation-fixture"),
  actor: {
    actorReference: "emma-fixture",
    kind: "AiAgent",
  },
  correlationId: correlationId("correlation-fixture"),
  causationId: causationId("causation-fixture"),
  conversationVersion: 3,
  conversationStatus: "Active",
  authorizedCapabilities: createCapabilitySet([
    "conversation.read",
    "conversation.respond",
  ]),
  delegation: {
    status: "current",
    reference: "delegation-fixture",
    issuedForVersion: 3,
  },
  purpose: "produce_patient_response",
  input: { message: "I need an appointment." },
  contextEntries: [{ source: "conversation", sequence: 1 }],
  availableTools: [],
  inputTokenEstimate: 20,
  budget: budget(),
  providerPolicy: providerPolicy(),
  ...overrides,
});

export const request = (overrides = {}) =>
  createExecutionRequest(requestInput(overrides));

export const bookingPlannerResult = (overrides = {}) =>
  validPlannerResult({
    purpose: "propose_booking_action",
    proposedCapability: "booking.create",
    proposedTool: {
      identifier: toolIdentifier("booking.create"),
      version: "1",
      arguments: {
        locationReference: "location-fixture",
        startTime: "2026-08-01T10:00:00.000Z",
      },
      confirmationStatus: "required",
      humanApprovalStatus: "not_required",
    },
    patientResponse: null,
    ...overrides,
  });

export const bookingRequest = (overrides = {}) =>
  request({
    authorizedCapabilities: createCapabilitySet(["booking.create"]),
    purpose: "propose_booking_action",
    availableTools: [bookingTool()],
    providerPolicy: providerPolicy({
      candidates: [
        {
          providerId: providerIdentifier("reference.primary"),
          modelId: modelIdentifier("reference.model"),
          allowedPurposes: ["propose_booking_action"],
        },
      ],
    }),
    ...overrides,
  });
