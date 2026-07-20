import type { TenantId } from "@reviva/domain";

import type { CorrelationId, CausationId, ParticipantId } from "../identifiers/identifiers.js";

export const actorKinds = [
  "Staff",
  "Patient",
  "AiAgent",
  "System",
  "ExternalIntegration",
  "HumanOperator",
] as const;

export type ActorKind = (typeof actorKinds)[number];

export type DelegationReference = Readonly<{
  id: string;
  issuedForConversationVersion: number;
}>;

export type ActorContext = Readonly<{
  kind: ActorKind;
  actorReference: string;
  authenticatedPrincipalReference: string | null;
  delegationReference: DelegationReference | null;
  tenantId: TenantId;
  correlationId: CorrelationId;
  causationId: CausationId | null;
}>;

export type Participant = Readonly<{
  id: ParticipantId;
  kind: ActorKind;
  actorReference: string;
  joinedAt: string;
}>;

export type ConversationOwner = Readonly<
  | { kind: "unassigned"; actorReference: null }
  | { kind: "ai"; actorReference: string }
  | { kind: "human"; actorReference: string }
>;
