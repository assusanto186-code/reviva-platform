import type { Capability } from "../capabilities/capability.js";

const authorizationReasonValues = [
  "authorized",
  "invalid_authorization_context",
  "capability_not_globally_allowed",
  "capability_not_in_subscription",
  "capability_disabled_by_tenant",
  "capability_disabled_by_location",
  "actor_not_authorized",
  "membership_not_active",
  "delegation_missing",
  "delegation_stale",
  "delegation_tool_scope_missing",
  "conversation_state_disallows_action",
  "patient_confirmation_required",
  "fresh_confirmation_required",
  "human_approval_required",
  "conversation_handed_off",
  "assist_only_no_execution",
  "reactivation_basis_required",
  "reactivation_opted_out",
  "tool_not_registered",
  "tool_capability_mismatch",
  "tool_actor_not_allowed",
] as const;

export type AuthorizationReason = (typeof authorizationReasonValues)[number];
export const authorizationReasons: readonly AuthorizationReason[] =
  Object.freeze([...authorizationReasonValues]);

type Decision<Type extends string> = Readonly<{
  type: Type;
  capability: Capability;
  reason: AuthorizationReason;
}>;

export type AuthorizationDecision =
  | Decision<"Allowed">
  | Decision<"Denied">
  | Decision<"ConfirmationRequired">
  | Decision<"HumanApprovalRequired">
  | Decision<"HandoffRequired">;
