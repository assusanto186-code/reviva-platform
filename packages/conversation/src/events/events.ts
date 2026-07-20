import type { LocationId, TenantId } from "@reviva/domain";

import type { ConversationChannel } from "../aggregate/conversation.js";
import type { BookingOperation, BookingProgressPatch } from "../booking/booking.js";
import type { HandoffUrgency } from "../handoff/handoff.js";
import type {
  CommandId,
  ContactId,
  ConversationEventId,
  ConversationId,
  CorrelationId,
  CausationId,
  HandoffId,
  MessageId,
  ToolIntentId,
} from "../identifiers/identifiers.js";
import type { ActorContext, ConversationOwner, DelegationReference, Participant } from "../participants/participants.js";
import type { ReactivationResponse } from "../reactivation/reactivation.js";

type BaseEvent<Type extends string, Payload> = Readonly<{
  type: Type;
  eventVersion: 1;
  eventId: ConversationEventId;
  commandId: CommandId;
  conversationId: ConversationId;
  tenantId: TenantId;
  sequence: number;
  actor: ActorContext;
  occurredAt: string;
  correlationId: CorrelationId;
  causationId: CausationId | null;
  payload: Readonly<Payload>;
}>;

export type ConversationStarted = BaseEvent<"ConversationStarted", {
  locationId: LocationId | null;
  channel: ConversationChannel;
  participants: readonly Participant[];
  contactId: ContactId;
  initialOwner: ConversationOwner;
}>;
export type InboundMessageRecorded = BaseEvent<"InboundMessageRecorded", {
  messageId: MessageId;
  author: ActorContext;
  contentKind: "plain_text";
  content: string;
  externalMessageReference: string | null;
  receivedAt: string;
}>;
export type OutboundMessageRecorded = BaseEvent<"OutboundMessageRecorded", {
  messageId: MessageId;
  author: ActorContext;
  contentKind: "plain_text";
  content: string;
  externalMessageReference: string | null;
  sentAt: string;
  deliveryIntentReference: string | null;
}>;
export type ConversationAwaitingUser = BaseEvent<"ConversationAwaitingUser", { reason: string }>;
export type ToolActionProposed = BaseEvent<"ToolActionProposed", {
  toolIntentId: ToolIntentId;
  action: string;
  effectDigest: string;
}>;
export type ConfirmationRequested = BaseEvent<"ConfirmationRequested", {
  effectDigest: string;
  summaryReference: string;
}>;
export type PatientConfirmed = BaseEvent<"PatientConfirmed", { effectDigest: string }>;
export type PatientConfirmationRejected = BaseEvent<"PatientConfirmationRejected", {
  effectDigest: string;
  reason: string;
}>;
export type ToolExecutionScheduled = BaseEvent<"ToolExecutionScheduled", {
  toolIntentId: ToolIntentId;
  action: string;
  effectDigest: string;
}>;
export type ToolExecutionSucceeded = BaseEvent<"ToolExecutionSucceeded", {
  toolIntentId: ToolIntentId;
  effectDigest: string;
  outcomeReference: string;
  nextStatus: "Active" | "AwaitingUser" | "Resolved";
}>;
export type ToolExecutionFailed = BaseEvent<"ToolExecutionFailed", {
  toolIntentId: ToolIntentId;
  effectDigest: string;
  reasonCode: string;
  recoverable: boolean;
}>;
export type HumanHandoffRequested = BaseEvent<"HumanHandoffRequested", {
  handoffId: HandoffId;
  reason: string;
  urgency: HandoffUrgency;
  targetQueueReference: string;
  responseDeadline: string | null;
}>;
export type HumanHandoffAccepted = BaseEvent<"HumanHandoffAccepted", {
  handoffId: HandoffId;
  assigneeReference: string;
}>;
export type HumanHandoffResolved = BaseEvent<"HumanHandoffResolved", {
  handoffId: HandoffId;
  resolution: string;
  nextStatus: "Active" | "Resolved";
}>;
export type AutomationResumed = BaseEvent<"AutomationResumed", {
  freshDelegationReference: DelegationReference;
  aiActorReference: string;
}>;
export type ConversationAssigned = BaseEvent<"ConversationAssigned", { owner: ConversationOwner }>;
export type BookingIntentRecorded = BaseEvent<"BookingIntentRecorded", { operation: BookingOperation }>;
export type BookingProgressUpdated = BaseEvent<"BookingProgressUpdated", {
  patch: BookingProgressPatch;
  invalidatesConfirmation: boolean;
}>;
export type ReactivationResponseRecorded = BaseEvent<"ReactivationResponseRecorded", {
  campaignReference: string;
  outreachSequenceReference: string;
  response: ReactivationResponse;
}>;
export type ConversationResolved = BaseEvent<"ConversationResolved", { reason: string }>;
export type ConversationClosed = BaseEvent<"ConversationClosed", { reason: string }>;
export type ConversationReopened = BaseEvent<"ConversationReopened", {
  reason: string;
  owner: ConversationOwner;
}>;
export type ConversationFailed = BaseEvent<"ConversationFailed", {
  failureCode: string;
  recoverable: boolean;
}>;
export type ConversationRecovered = BaseEvent<"ConversationRecovered", {
  reason: string;
  owner: ConversationOwner;
}>;

export type ConversationEvent =
  | ConversationStarted
  | InboundMessageRecorded
  | OutboundMessageRecorded
  | ConversationAwaitingUser
  | ToolActionProposed
  | ConfirmationRequested
  | PatientConfirmed
  | PatientConfirmationRejected
  | ToolExecutionScheduled
  | ToolExecutionSucceeded
  | ToolExecutionFailed
  | HumanHandoffRequested
  | HumanHandoffAccepted
  | HumanHandoffResolved
  | AutomationResumed
  | ConversationAssigned
  | BookingIntentRecorded
  | BookingProgressUpdated
  | ReactivationResponseRecorded
  | ConversationResolved
  | ConversationClosed
  | ConversationReopened
  | ConversationFailed
  | ConversationRecovered;
