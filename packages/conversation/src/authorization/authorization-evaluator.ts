import type { Capability } from "../capabilities/capability.js";
import {
  capabilitySetHas,
  isCapability,
} from "../capabilities/capability.js";
import { deepFreeze } from "../internal/immutable.js";
import type { ActorKind } from "../participants/participants.js";
import type {
  ToolDescriptor,
  ToolRegistry,
} from "../tools/tool-registry.js";
import type { AuthorizationContext } from "./authorization-context.js";
import { createAuthorizationContext } from "./authorization-context.js";
import type {
  AuthorizationDecision,
  AuthorizationReason,
} from "./authorization-decision.js";
import { InvalidAuthorizationContext } from "./authorization-failure.js";

const decision = (
  type: AuthorizationDecision["type"],
  capability: Capability,
  reason: AuthorizationReason,
): AuthorizationDecision => deepFreeze({ type, capability, reason });

const autonomousActorKinds: readonly ActorKind[] = [
  "AiAgent",
  "System",
  "ExternalIntegration",
];

const isAutonomous = (kind: ActorKind): boolean =>
  autonomousActorKinds.includes(kind);

const evidenceMatches = (
  evidence: Readonly<{ status: string; effectDigest: string | null }>,
  effectDigest: string | null,
): boolean =>
  evidence.status === "current" &&
  effectDigest !== null &&
  evidence.effectDigest === effectDigest;

const checkAuthorityIntersection = (
  context: AuthorizationContext,
): AuthorizationDecision | null => {
  const requested = context.requestedCapability;
  if (!capabilitySetHas(context.globalAuthority, requested)) {
    return decision("Denied", requested, "capability_not_globally_allowed");
  }
  if (!capabilitySetHas(context.subscriptionAuthority, requested)) {
    return decision("Denied", requested, "capability_not_in_subscription");
  }
  if (!capabilitySetHas(context.tenantAuthority, requested)) {
    return decision("Denied", requested, "capability_disabled_by_tenant");
  }
  if (
    context.locationAuthority.mode === "restricted" &&
    !capabilitySetHas(context.locationAuthority.capabilities, requested)
  ) {
    return decision("Denied", requested, "capability_disabled_by_location");
  }
  if (!capabilitySetHas(context.actorAuthority, requested)) {
    return decision("Denied", requested, "actor_not_authorized");
  }

  if (
    (context.actor.kind === "Staff" || context.actor.kind === "HumanOperator") &&
    context.membership.status !== "active"
  ) {
    return decision("Denied", requested, "membership_not_active");
  }

  if (context.actor.kind === "AiAgent") {
    if (context.delegation.status !== "active") {
      return decision("Denied", requested, "delegation_missing");
    }
    if (
      context.delegation.issuedForConversationVersion !==
      context.conversation.version
    ) {
      return decision("Denied", requested, "delegation_stale");
    }
    if (!capabilitySetHas(context.delegation.capabilities, requested)) {
      return decision("Denied", requested, "delegation_missing");
    }
    if (
      context.requestedToolIdentifier !== null &&
      !context.delegation.toolIdentifiers.includes(
        context.requestedToolIdentifier,
      )
    ) {
      return decision("Denied", requested, "delegation_tool_scope_missing");
    }
  }

  return null;
};

const checkConversationPolicy = (
  context: AuthorizationContext,
): AuthorizationDecision | null => {
  const requested = context.requestedCapability;
  const conversation = context.conversation;

  if (
    context.participation === "none" &&
    (context.actor.kind === "Patient" ||
      context.actor.kind === "AiAgent" ||
      context.actor.kind === "ExternalIntegration")
  ) {
    return decision("Denied", requested, "actor_not_authorized");
  }

  if (
    conversation.status === "Closed" &&
    requested !== "conversation.read" &&
    requested !== "conversation.reopen"
  ) {
    return decision(
      "Denied",
      requested,
      "conversation_state_disallows_action",
    );
  }

  if (
    conversation.status === "Resolved" &&
    requested !== "conversation.read" &&
    requested !== "conversation.reopen"
  ) {
    return decision(
      "Denied",
      requested,
      "conversation_state_disallows_action",
    );
  }

  if (
    conversation.status === "Failed" &&
    (requested !== "conversation.recover" || !conversation.failure?.recoverable)
  ) {
    return decision(
      "Denied",
      requested,
      "conversation_state_disallows_action",
    );
  }

  if (
    isAutonomous(context.actor.kind) &&
    (conversation.status === "AwaitingHuman" ||
      conversation.status === "HandedOff")
  ) {
    if (conversation.handoff?.aiOperatingMode === "assist_only") {
      return decision("Denied", requested, "assist_only_no_execution");
    }
    return decision("HandoffRequired", requested, "conversation_handed_off");
  }

  if (
    requested === "automation.resume" &&
    (context.actor.kind !== "Staff" &&
      context.actor.kind !== "HumanOperator")
  ) {
    return decision("Denied", requested, "actor_not_authorized");
  }

  if (requested === "automation.resume") {
    if (context.delegation.status !== "active") {
      return decision("Denied", requested, "delegation_missing");
    }
    if (
      context.delegation.issuedForConversationVersion !== conversation.version
    ) {
      return decision("Denied", requested, "delegation_stale");
    }
  }

  return null;
};

const checkProductPolicy = (
  context: AuthorizationContext,
): AuthorizationDecision | null => {
  const requested = context.requestedCapability;

  if (
    requested === "booking.create" ||
    requested === "booking.modify"
  ) {
    if (!evidenceMatches(context.confirmation, context.effectDigest)) {
      const reason =
        requested === "booking.modify" ||
        context.confirmation.status === "stale"
          ? "fresh_confirmation_required"
          : "patient_confirmation_required";
      return decision("ConfirmationRequired", requested, reason);
    }
  }

  if (requested === "booking.cancel.request") {
    if (isAutonomous(context.actor.kind)) {
      return decision(
        "HumanApprovalRequired",
        requested,
        "human_approval_required",
      );
    }
    if (!evidenceMatches(context.humanApproval, context.effectDigest)) {
      return decision(
        "HumanApprovalRequired",
        requested,
        "human_approval_required",
      );
    }
  }

  if (requested === "reactivation.start") {
    if (context.conversation.reactivation?.response === "opted_out") {
      return decision("Denied", requested, "reactivation_opted_out");
    }
    if (context.reactivationCommunicationBasis !== "approved") {
      return decision("Denied", requested, "reactivation_basis_required");
    }
  }

  return null;
};

export const authorizeCapability = (
  rawContext: AuthorizationContext,
): AuthorizationDecision => {
  let context: AuthorizationContext;
  try {
    context = createAuthorizationContext(rawContext);
  } catch (error) {
    if (error instanceof InvalidAuthorizationContext) {
      return decision(
        "Denied",
        isCapability(rawContext?.requestedCapability)
          ? rawContext.requestedCapability
          : "conversation.read",
        "invalid_authorization_context",
      );
    }
    throw error;
  }

  return (
    checkAuthorityIntersection(context) ??
    checkConversationPolicy(context) ??
    checkProductPolicy(context) ??
    decision("Allowed", context.requestedCapability, "authorized")
  );
};

export type ToolAuthorizationRequest = Readonly<{
  toolIdentifier: string;
  version: string;
  declaredCapability: Capability;
}>;

const checkDescriptorPolicy = (
  context: AuthorizationContext,
  descriptor: ToolDescriptor,
): AuthorizationDecision | null => {
  const requested = descriptor.requiredCapability;
  if (!descriptor.allowedActorKinds.includes(context.actor.kind)) {
    return decision("Denied", requested, "tool_actor_not_allowed");
  }
  if (
    descriptor.confirmation === "required" &&
    !evidenceMatches(context.confirmation, context.effectDigest)
  ) {
    return decision(
      "ConfirmationRequired",
      requested,
      context.confirmation.status === "stale"
        ? "fresh_confirmation_required"
        : "patient_confirmation_required",
    );
  }
  if (
    descriptor.humanApproval === "required" &&
    !evidenceMatches(context.humanApproval, context.effectDigest)
  ) {
    return decision(
      "HumanApprovalRequired",
      requested,
      "human_approval_required",
    );
  }
  return null;
};

export const authorizeToolRequest = (
  context: AuthorizationContext,
  registry: ToolRegistry,
  request: ToolAuthorizationRequest,
): AuthorizationDecision => {
  const lookup = registry.findByIdentifier(
    request.toolIdentifier,
    request.version,
  );
  if (!lookup.ok) {
    return decision(
      "Denied",
      context.requestedCapability,
      "tool_not_registered",
    );
  }

  const descriptor = lookup.value;
  if (
    request.declaredCapability !== descriptor.requiredCapability ||
    context.requestedCapability !== descriptor.requiredCapability
  ) {
    return decision(
      "Denied",
      context.requestedCapability,
      "tool_capability_mismatch",
    );
  }

  const scopedContext: AuthorizationContext = {
    ...context,
    requestedToolIdentifier: descriptor.identifier,
  };
  const capabilityDecision = authorizeCapability(scopedContext);
  return capabilityDecision.type === "Allowed"
    ? checkDescriptorPolicy(scopedContext, descriptor) ??
        decision("Allowed", descriptor.requiredCapability, "authorized")
    : capabilityDecision;
};
