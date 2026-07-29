import type { Capability } from "@reviva/conversation";

import { deepFreeze } from "./internal/immutable.js";

export const executionPurposes = [
  "classify_intent",
  "produce_patient_response",
  "propose_booking_action",
  "propose_booking_modification",
  "propose_cancellation_request",
  "propose_reactivation_action",
  "summarize_conversation",
  "assist_human_operator",
  "extract_structured_facts",
] as const;

export type ExecutionPurpose = (typeof executionPurposes)[number];

declare const executionReasonCodeBrand: unique symbol;
export type ExecutionReasonCode = string & {
  readonly [executionReasonCodeBrand]: "ExecutionReasonCode";
};

export class InvalidExecutionReasonCode extends Error {
  readonly code = "InvalidExecutionReasonCode" as const;

  constructor() {
    super("Execution reason code is invalid.");
    this.name = "InvalidExecutionReasonCode";
  }
}

const safeReasonCode = /^[a-z][a-z0-9._-]{0,127}$/u;

export const executionReasonCode = (value: string): ExecutionReasonCode => {
  if (value !== value.trim() || !safeReasonCode.test(value)) {
    throw new InvalidExecutionReasonCode();
  }
  return value as ExecutionReasonCode;
};

export type ExecutionPurposeDefinition = Readonly<{
  purpose: ExecutionPurpose;
  outputSchema: "planner_result.v1";
  toolProposalAllowed: boolean;
  requiredCapability: Capability;
  allowedProposedCapabilities: readonly Capability[];
  autonomousEffectsProhibited: boolean;
  budgetClass: "light" | "standard" | "sensitive";
  providerPolicyCategory:
    | "classification"
    | "response"
    | "action_proposal"
    | "summary";
}>;

const definitions: readonly ExecutionPurposeDefinition[] = deepFreeze([
  {
    purpose: "classify_intent",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: false,
    requiredCapability: "conversation.read",
    allowedProposedCapabilities: [],
    autonomousEffectsProhibited: true,
    budgetClass: "light",
    providerPolicyCategory: "classification",
  },
  {
    purpose: "produce_patient_response",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: false,
    requiredCapability: "conversation.respond",
    allowedProposedCapabilities: ["conversation.respond"],
    autonomousEffectsProhibited: true,
    budgetClass: "standard",
    providerPolicyCategory: "response",
  },
  {
    purpose: "propose_booking_action",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: true,
    requiredCapability: "booking.create",
    allowedProposedCapabilities: ["booking.create"],
    autonomousEffectsProhibited: false,
    budgetClass: "sensitive",
    providerPolicyCategory: "action_proposal",
  },
  {
    purpose: "propose_booking_modification",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: true,
    requiredCapability: "booking.modify",
    allowedProposedCapabilities: ["booking.modify"],
    autonomousEffectsProhibited: false,
    budgetClass: "sensitive",
    providerPolicyCategory: "action_proposal",
  },
  {
    purpose: "propose_cancellation_request",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: true,
    requiredCapability: "booking.cancel.request",
    allowedProposedCapabilities: ["booking.cancel.request"],
    autonomousEffectsProhibited: true,
    budgetClass: "sensitive",
    providerPolicyCategory: "action_proposal",
  },
  {
    purpose: "propose_reactivation_action",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: true,
    requiredCapability: "reactivation.start",
    allowedProposedCapabilities: ["reactivation.start"],
    autonomousEffectsProhibited: false,
    budgetClass: "sensitive",
    providerPolicyCategory: "action_proposal",
  },
  {
    purpose: "summarize_conversation",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: false,
    requiredCapability: "conversation.read",
    allowedProposedCapabilities: [],
    autonomousEffectsProhibited: true,
    budgetClass: "standard",
    providerPolicyCategory: "summary",
  },
  {
    purpose: "assist_human_operator",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: false,
    requiredCapability: "conversation.read",
    allowedProposedCapabilities: [],
    autonomousEffectsProhibited: true,
    budgetClass: "standard",
    providerPolicyCategory: "response",
  },
  {
    purpose: "extract_structured_facts",
    outputSchema: "planner_result.v1",
    toolProposalAllowed: false,
    requiredCapability: "conversation.read",
    allowedProposedCapabilities: [],
    autonomousEffectsProhibited: true,
    budgetClass: "light",
    providerPolicyCategory: "classification",
  },
]);

export const executionPurposeDefinition = (
  purpose: string,
): ExecutionPurposeDefinition | null =>
  definitions.find((definition) => definition.purpose === purpose) ?? null;
