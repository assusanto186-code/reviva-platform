import {
  canonicalRequestFingerprint,
  capabilitySetHas,
  createToolRegistry,
  isCapability,
} from "@reviva/conversation";

import type {
  ExecutionRequest,
  PlannerResult,
  PlannerToolOutput,
  StructuredOutputSchema,
  StructuredOutputValidation,
  ToolProposal,
} from "./contracts.js";
import { schemaIdentifier } from "./identifiers.js";
import { cloneCanonicalValue } from "./internal/canonical.js";
import { deepFreeze } from "./internal/immutable.js";
import {
  executionPurposeDefinition,
  executionReasonCode,
} from "./purposes.js";

const plannerKeys = [
  "schemaVersion",
  "purpose",
  "proposedCapability",
  "proposedTool",
  "confidenceBand",
  "patientResponse",
  "operatorSummary",
  "escalation",
  "reasonCodes",
] as const;
const toolKeys = [
  "identifier",
  "version",
  "arguments",
  "confirmationStatus",
  "humanApprovalStatus",
] as const;

const plainRecord = (value: unknown): Record<string, unknown> | null => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }
  return value as Record<string, unknown>;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    keys.every((key) => expected.includes(key))
  );
};

const boundedText = (value: unknown): value is string | null =>
  value === null ||
  (typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4_000 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value));

const invalid = (
  failures: readonly string[],
): StructuredOutputValidation<PlannerResult> =>
  deepFreeze({ valid: false, failures: [...new Set(failures)].sort() });

const validateTool = (
  value: unknown,
  request: ExecutionRequest,
  proposedCapability: PlannerResult["proposedCapability"],
  failures: string[],
): PlannerToolOutput | null => {
  if (value === null) return null;
  const tool = plainRecord(value);
  if (tool === null || !exactKeys(tool, toolKeys)) {
    failures.push("invalid_tool_shape");
    return null;
  }
  if (
    typeof tool.identifier !== "string" ||
    typeof tool.version !== "string" ||
    !["not_required", "required", "confirmed"].includes(
      String(tool.confirmationStatus),
    ) ||
    !["not_required", "required", "approved"].includes(
      String(tool.humanApprovalStatus),
    )
  ) {
    failures.push("invalid_tool_fields");
    return null;
  }
  try {
    canonicalRequestFingerprint(
      tool.arguments as Parameters<typeof canonicalRequestFingerprint>[0],
    );
  } catch {
    failures.push("invalid_tool_arguments");
    return null;
  }
  const registry = createToolRegistry(request.availableTools);
  const descriptor = registry.findByIdentifier(tool.identifier, tool.version);
  if (!descriptor.ok) {
    failures.push("tool_not_registered");
    return null;
  }
  if (proposedCapability !== descriptor.value.requiredCapability) {
    failures.push("tool_capability_mismatch");
  }
  if (
    !capabilitySetHas(
      request.authorizedCapabilities,
      descriptor.value.requiredCapability,
    )
  ) {
    failures.push("capability_not_authorized");
  }
  if (!descriptor.value.allowedActorKinds.includes(request.actor.kind)) {
    failures.push("actor_not_allowed_for_tool");
  }
  if (
    (descriptor.value.confirmation === "required" &&
      tool.confirmationStatus !== "required") ||
    (descriptor.value.confirmation === "never" &&
      tool.confirmationStatus !== "not_required")
  ) {
    failures.push("confirmation_status_mismatch");
  }
  if (
    (descriptor.value.humanApproval === "required" &&
      tool.humanApprovalStatus !== "required") ||
    (descriptor.value.humanApproval === "never" &&
      tool.humanApprovalStatus !== "not_required")
  ) {
    failures.push("human_approval_status_mismatch");
  }
  return deepFreeze({
    identifier: descriptor.value.identifier,
    version: descriptor.value.version,
    arguments: cloneCanonicalValue(
      tool.arguments as PlannerToolOutput["arguments"],
    ),
    confirmationStatus:
      tool.confirmationStatus as PlannerToolOutput["confirmationStatus"],
    humanApprovalStatus:
      tool.humanApprovalStatus as PlannerToolOutput["humanApprovalStatus"],
  });
};

export const plannerOutputSchema: StructuredOutputSchema<PlannerResult> =
  Object.freeze({
    contract: Object.freeze({
      schemaId: schemaIdentifier("planner_result"),
      schemaVersion: 1 as const,
      unknownFields: "reject" as const,
    }),
    validate(
      value: unknown,
      request: ExecutionRequest,
    ): StructuredOutputValidation<PlannerResult> {
      const failures: string[] = [];
      const candidate = plainRecord(value);
      if (candidate === null || !exactKeys(candidate, plannerKeys)) {
        return invalid(["invalid_planner_shape"]);
      }
      if (candidate.schemaVersion !== 1) {
        failures.push("unsupported_schema_version");
      }
      if (candidate.purpose !== request.purpose) {
        failures.push("purpose_mismatch");
      }
      const definition = executionPurposeDefinition(request.purpose);
      if (definition === null) {
        return invalid(["unsupported_execution_purpose"]);
      }
      const proposedCapability =
        candidate.proposedCapability === null
          ? null
          : typeof candidate.proposedCapability === "string" &&
              isCapability(candidate.proposedCapability)
            ? candidate.proposedCapability
            : null;
      if (
        candidate.proposedCapability !== null &&
        proposedCapability === null
      ) {
        failures.push("invalid_capability");
      }
      if (
        proposedCapability !== null &&
        !definition.allowedProposedCapabilities.includes(proposedCapability)
      ) {
        failures.push("capability_not_allowed_for_purpose");
      }
      if (
        proposedCapability !== null &&
        !capabilitySetHas(request.authorizedCapabilities, proposedCapability)
      ) {
        failures.push("capability_not_authorized");
      }
      const tool = validateTool(
        candidate.proposedTool,
        request,
        proposedCapability,
        failures,
      );
      if (candidate.proposedTool !== null && !definition.toolProposalAllowed) {
        failures.push("tool_proposal_not_allowed");
      }
      if (
        definition.toolProposalAllowed &&
        candidate.proposedTool !== null &&
        proposedCapability === null
      ) {
        failures.push("tool_requires_capability");
      }
      if (
        !["low", "medium", "high"].includes(
          String(candidate.confidenceBand),
        )
      ) {
        failures.push("invalid_confidence_band");
      }
      if (
        !boundedText(candidate.patientResponse) ||
        !boundedText(candidate.operatorSummary)
      ) {
        failures.push("invalid_bounded_text");
      }
      if (
        request.purpose === "produce_patient_response" &&
        candidate.patientResponse === null
      ) {
        failures.push("patient_response_required");
      }
      if (
        request.purpose === "summarize_conversation" &&
        candidate.operatorSummary === null
      ) {
        failures.push("operator_summary_required");
      }
      if (!["none", "recommend_handoff"].includes(String(candidate.escalation))) {
        failures.push("invalid_escalation");
      }
      if (
        !Array.isArray(candidate.reasonCodes) ||
        candidate.reasonCodes.length > 16 ||
        candidate.reasonCodes.some(
          (reason) => {
            if (typeof reason !== "string") return true;
            try {
              executionReasonCode(reason);
              return false;
            } catch {
              return true;
            }
          },
        )
      ) {
        failures.push("invalid_reason_codes");
      }
      if (failures.length > 0) return invalid(failures);
      return deepFreeze({
        valid: true,
        value: {
          schemaVersion: 1,
          purpose: request.purpose,
          proposedCapability,
          proposedTool: tool,
          confidenceBand:
            candidate.confidenceBand as PlannerResult["confidenceBand"],
          patientResponse: candidate.patientResponse as string | null,
          operatorSummary: candidate.operatorSummary as string | null,
          escalation: candidate.escalation as PlannerResult["escalation"],
          reasonCodes: (candidate.reasonCodes as string[]).map((reason) =>
            executionReasonCode(reason),
          ),
        },
      });
    },
  });

export const createToolProposal = (
  request: ExecutionRequest,
  plannerResult: PlannerResult,
): ToolProposal | null => {
  const tool = plannerResult.proposedTool;
  const capability = plannerResult.proposedCapability;
  if (tool === null || capability === null) return null;
  return deepFreeze({
    schemaVersion: 1,
    toolIdentifier: tool.identifier,
    toolVersion: tool.version,
    requiredCapability: capability,
    arguments: tool.arguments,
    effectDigest: canonicalRequestFingerprint({
      executionId: request.executionId,
      purpose: request.purpose,
      toolIdentifier: tool.identifier,
      toolVersion: tool.version,
      arguments: tool.arguments,
    }),
    confirmationStatus: tool.confirmationStatus,
    humanApprovalStatus: tool.humanApprovalStatus,
    correlationId: request.correlationId,
    sourceExecutionId: request.executionId,
  });
};
