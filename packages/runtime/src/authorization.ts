import {
  authorizeToolRequest,
  createAuthorizationContext,
  type AuthorizationContext,
} from "@reviva/conversation";

import type {
  RuntimeExecutionRequest,
  RuntimeFailure,
  RuntimeToolDescriptor,
  ToolResultStatus,
} from "./contracts.js";
import { runtimeConversationToolRegistry } from "./registry.js";
import type { RuntimeToolRegistry } from "./contracts.js";
import { deepFreeze } from "./internal/immutable.js";

export type RuntimeAuthorizationOutcome =
  | Readonly<{ allowed: true; context: AuthorizationContext }>
  | Readonly<{
      allowed: false;
      status: Extract<
        ToolResultStatus,
        | "Denied"
        | "AwaitingConfirmation"
        | "AwaitingHumanApproval"
        | "Failed"
      >;
      failure: RuntimeFailure;
    }>;

const denied = (
  status: Exclude<RuntimeAuthorizationOutcome, { allowed: true }>["status"],
  code: RuntimeFailure["code"],
  safeReason: string,
): RuntimeAuthorizationOutcome =>
  deepFreeze({
    allowed: false,
    status,
    failure: { code, safeReason },
  });

const evidenceScopeMatches = (
  request: RuntimeExecutionRequest,
  evidence: Readonly<{
    tenantId: string;
    conversationId: string;
    actorReference: string;
    effectDigest: string;
    conversationVersion: number;
    correlationId: string;
  }>,
): boolean =>
  evidence.tenantId === request.tenantId &&
  evidence.conversationId === request.conversationId &&
  evidence.actorReference === request.actor.actorReference &&
  evidence.effectDigest === request.validatedToolProposal.effectDigest &&
  evidence.conversationVersion === request.expectedConversationVersion &&
  evidence.correlationId === request.correlationId;

const isExpiredAtRequestTime = (
  expiresAt: string | null,
  requestedAt: string,
): boolean => expiresAt !== null && expiresAt < requestedAt;

const timeoutLimits = Object.freeze({
  short: 5_000,
  standard: 30_000,
  long: 120_000,
});

export const revalidateRuntimeAuthorization = (
  request: RuntimeExecutionRequest,
  descriptor: RuntimeToolDescriptor,
  registry: RuntimeToolRegistry,
): RuntimeAuthorizationOutcome => {
  const proposal = request.validatedToolProposal;
  if (
    proposal.toolIdentifier !== descriptor.tool.identifier ||
    proposal.toolVersion !== descriptor.tool.version ||
    proposal.requiredCapability !== descriptor.tool.requiredCapability ||
    request.authorizationContext.requestedCapability !==
      descriptor.tool.requiredCapability
  ) {
    return denied(
      "Denied",
      "RuntimeToolSchemaMismatch",
      "runtime_tool_contract_mismatch",
    );
  }
  if (!descriptor.tool.allowedActorKinds.includes(request.actor.kind)) {
    return denied("Denied", "ActorNotAllowed", "runtime_actor_not_allowed");
  }
  if (
    request.transaction.timeoutMilliseconds >
    timeoutLimits[descriptor.timeoutClass]
  ) {
    return denied(
      "Failed",
      "RuntimeBudgetExceeded",
      "runtime_timeout_budget_exceeded",
    );
  }

  const confirmation = request.confirmationEvidence;
  if (descriptor.tool.confirmation === "required") {
    if (
      confirmation.status === "not_required" ||
      confirmation.status === "missing"
    ) {
      return denied(
        "AwaitingConfirmation",
        "ConfirmationRequired",
        "patient_confirmation_required",
      );
    }
    if (
      !("expiresAt" in confirmation) ||
      confirmation.status === "expired" ||
      isExpiredAtRequestTime(
        confirmation.expiresAt,
        request.transaction.requestedAt,
      )
    ) {
      return denied(
        "AwaitingConfirmation",
        "ConfirmationExpired",
        "patient_confirmation_expired",
      );
    }
    if (
      !("tenantId" in confirmation) ||
      !evidenceScopeMatches(request, confirmation)
    ) {
      return denied(
        "Denied",
        "ConfirmationContextMismatch",
        "patient_confirmation_scope_mismatch",
      );
    }
  }

  const humanApproval = request.humanApprovalEvidence;
  if (descriptor.tool.humanApproval === "required") {
    if (
      humanApproval.status === "not_required" ||
      humanApproval.status === "missing"
    ) {
      return denied(
        "AwaitingHumanApproval",
        "HumanApprovalRequired",
        "human_approval_required",
      );
    }
    if (
      !("expiresAt" in humanApproval) ||
      humanApproval.status === "expired" ||
      isExpiredAtRequestTime(
        humanApproval.expiresAt,
        request.transaction.requestedAt,
      )
    ) {
      return denied(
        "AwaitingHumanApproval",
        "ApprovalExpired",
        "human_approval_expired",
      );
    }
    if (
      !("tenantId" in humanApproval) ||
      !evidenceScopeMatches(request, humanApproval)
    ) {
      return denied(
        "Denied",
        "ApprovalContextMismatch",
        "human_approval_scope_mismatch",
      );
    }
  }

  const context = createAuthorizationContext({
    ...request.authorizationContext,
    actor: {
      ...request.authorizationContext.actor,
      kind: request.actor.kind,
      actorReference: request.actor.actorReference,
    },
    requestedCapability: descriptor.tool.requiredCapability,
    requestedToolIdentifier: descriptor.tool.identifier,
    effectDigest: proposal.effectDigest,
    confirmation:
      descriptor.tool.confirmation === "required"
        ? { status: "current", effectDigest: proposal.effectDigest }
        : { status: "not_required", effectDigest: null },
    humanApproval:
      descriptor.tool.humanApproval === "required"
        ? {
            status: "current",
            effectDigest: proposal.effectDigest,
            approverReference:
              humanApproval.status === "current"
                ? humanApproval.approverReference
                : null,
          }
        : {
            status: "not_required",
            effectDigest: null,
            approverReference: null,
          },
  });
  const decision = authorizeToolRequest(
    context,
    runtimeConversationToolRegistry(registry),
    {
      toolIdentifier: descriptor.tool.identifier,
      version: descriptor.tool.version,
      declaredCapability: proposal.requiredCapability,
    },
  );
  if (decision.type === "Allowed") {
    return deepFreeze({ allowed: true, context });
  }
  if (decision.type === "ConfirmationRequired") {
    return denied(
      "AwaitingConfirmation",
      "ConfirmationRequired",
      decision.reason,
    );
  }
  if (decision.type === "HumanApprovalRequired") {
    return denied(
      "AwaitingHumanApproval",
      "HumanApprovalRequired",
      decision.reason,
    );
  }
  if (decision.type === "HandoffRequired") {
    return denied("Denied", "HandoffRestriction", decision.reason);
  }
  const delegationReason = decision.reason.startsWith("delegation_");
  return denied(
    "Denied",
    delegationReason ? "DelegationDenied" : "CapabilityNotAuthorized",
    decision.reason,
  );
};
