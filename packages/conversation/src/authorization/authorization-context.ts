import type {
  LocationId,
  MembershipStatus,
  TenantId,
  TenantRole,
} from "@reviva/domain";

import type { Conversation } from "../aggregate/conversation.js";
import {
  isCapability,
  type Capability,
  type CapabilitySet,
} from "../capabilities/capability.js";
import { deepFreeze } from "../internal/immutable.js";
import {
  actorKinds,
  type ActorKind,
} from "../participants/participants.js";
import { InvalidAuthorizationContext } from "./authorization-failure.js";

export type MembershipAuthority =
  | Readonly<{ status: MembershipStatus; role: TenantRole }>
  | Readonly<{ status: "not_applicable"; role: null }>;

export type LocationAuthority =
  | Readonly<{ mode: "not_applicable"; capabilities: null }>
  | Readonly<{ mode: "restricted"; capabilities: CapabilitySet }>;

export type DelegationAuthority =
  | Readonly<{ status: "not_required" | "missing" | "revoked" }>
  | Readonly<{
      status: "active";
      reference: string;
      capabilities: CapabilitySet;
      toolIdentifiers: readonly string[];
      issuedForConversationVersion: number;
    }>;

export type ConfirmationEvidence = Readonly<{
  status: "not_required" | "missing" | "current" | "stale";
  effectDigest: string | null;
}>;

export type HumanApprovalEvidence = Readonly<{
  status: "not_required" | "missing" | "current" | "stale";
  effectDigest: string | null;
  approverReference: string | null;
}>;

export type AuthorizationActor = Readonly<{
  kind: ActorKind;
  actorReference: string;
  authenticatedPrincipalReference: string | null;
}>;

export type AuthorizationContext = Readonly<{
  actor: AuthorizationActor;
  tenantId: TenantId;
  locationId: LocationId | null;
  membership: MembershipAuthority;
  globalAuthority: CapabilitySet;
  subscriptionAuthority: CapabilitySet;
  tenantAuthority: CapabilitySet;
  locationAuthority: LocationAuthority;
  actorAuthority: CapabilitySet;
  delegation: DelegationAuthority;
  conversation: Conversation;
  participation: "owner" | "participant" | "none";
  confirmation: ConfirmationEvidence;
  humanApproval: HumanApprovalEvidence;
  reactivationCommunicationBasis: "approved" | "missing" | "revoked";
  requestedCapability: Capability;
  requestedToolIdentifier: string | null;
  effectDigest: string | null;
}>;

const requiresMembership = (kind: ActorKind): boolean =>
  kind === "Staff" || kind === "HumanOperator";

const validCapabilitySet = (value: unknown): value is CapabilitySet =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as CapabilitySet).values) &&
  (value as CapabilitySet).values.every(isCapability);

export const createAuthorizationContext = (
  context: AuthorizationContext,
): AuthorizationContext => {
  if (
    !context ||
    !context.actor ||
    !context.membership ||
    !context.locationAuthority ||
    !context.delegation ||
    !context.confirmation ||
    !context.humanApproval ||
    !actorKinds.includes(context.actor.kind) ||
    !context.actor.actorReference.trim() ||
    !context.conversation ||
    context.conversation.tenantId !== context.tenantId ||
    context.conversation.locationId !== context.locationId
  ) {
    throw new InvalidAuthorizationContext("identity_or_scope_mismatch");
  }

  if (
    requiresMembership(context.actor.kind) &&
    (context.membership.status === "not_applicable" ||
      !context.actor.authenticatedPrincipalReference)
  ) {
    throw new InvalidAuthorizationContext("membership_or_principal_missing");
  }

  if (
    !requiresMembership(context.actor.kind) &&
    context.membership.status !== "not_applicable"
  ) {
    throw new InvalidAuthorizationContext("unexpected_membership");
  }

  if (
    context.locationId !== null &&
    context.locationAuthority.mode !== "restricted"
  ) {
    throw new InvalidAuthorizationContext("location_authority_missing");
  }

  if (
    context.locationId === null &&
    context.locationAuthority.mode !== "not_applicable"
  ) {
    throw new InvalidAuthorizationContext("unexpected_location_authority");
  }

  if (
    !validCapabilitySet(context.globalAuthority) ||
    !validCapabilitySet(context.subscriptionAuthority) ||
    !validCapabilitySet(context.tenantAuthority) ||
    !validCapabilitySet(context.actorAuthority) ||
    (context.locationAuthority.mode === "restricted" &&
      !validCapabilitySet(context.locationAuthority.capabilities)) ||
    !isCapability(context.requestedCapability)
  ) {
    throw new InvalidAuthorizationContext("authority_set_invalid");
  }

  if (
    context.delegation.status === "active" &&
    (!validCapabilitySet(context.delegation.capabilities) ||
      !Array.isArray(context.delegation.toolIdentifiers) ||
      !Number.isSafeInteger(context.delegation.issuedForConversationVersion))
  ) {
    throw new InvalidAuthorizationContext("delegation_invalid");
  }

  return deepFreeze(context);
};
