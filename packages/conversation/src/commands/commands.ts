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
import type {
  ActorContext,
  ConversationOwner,
  DelegationReference,
  Participant,
} from "../participants/participants.js";
import type { ReactivationResponse } from "../reactivation/reactivation.js";

export const conversationCapabilities = [
  "conversation.start",
  "conversation.message.record_inbound",
  "conversation.message.record_outbound",
  "conversation.await_user",
  "conversation.assign",
  "conversation.resolve",
  "conversation.close",
  "conversation.reopen",
  "conversation.fail",
  "conversation.recover",
  "booking.intent.record",
  "booking.progress.update",
  "booking.confirmation.request",
  "booking.confirmation.record",
  "tool.propose",
  "tool.result.record",
  "handoff.request",
  "handoff.accept",
  "handoff.resolve",
  "automation.resume",
  "reactivation.response.record",
] as const;

export type ConversationCapability = (typeof conversationCapabilities)[number];

type BaseCommand<Type extends string, Payload> = Readonly<{
  type: Type;
  commandId: CommandId;
  eventId: ConversationEventId;
  conversationId: ConversationId;
  expectedVersion: number;
  actor: ActorContext;
  requestedAt: string;
  correlationId: CorrelationId;
  causationId: CausationId | null;
  payload: Readonly<Payload>;
}>;

export type StartConversation = BaseCommand<"StartConversation", {
  tenantId: TenantId;
  locationId: LocationId | null;
  channel: ConversationChannel;
  participants: readonly Participant[];
  contactId: ContactId;
  initialOwner: ConversationOwner;
}>;

export type RecordInboundMessage = BaseCommand<"RecordInboundMessage", {
  messageId: MessageId;
  author: ActorContext;
  content: string;
  externalMessageReference: string | null;
  receivedAt: string;
}>;

export type RecordOutboundMessage = BaseCommand<"RecordOutboundMessage", {
  messageId: MessageId;
  author: ActorContext;
  content: string;
  externalMessageReference: string | null;
  sentAt: string;
  deliveryIntentReference: string | null;
}>;

export type MarkAwaitingUser = BaseCommand<"MarkAwaitingUser", { reason: string }>;
export type ProposeToolAction = BaseCommand<"ProposeToolAction", {
  toolIntentId: ToolIntentId;
  action: string;
  effectDigest: string;
}>;
export type RequestConfirmation = BaseCommand<"RequestConfirmation", {
  effectDigest: string;
  summaryReference: string;
}>;
export type RecordPatientConfirmation = BaseCommand<"RecordPatientConfirmation", {
  effectDigest: string;
}>;
export type RejectPatientConfirmation = BaseCommand<"RejectPatientConfirmation", {
  effectDigest: string;
  reason: string;
}>;
export type RecordToolScheduled = BaseCommand<"RecordToolScheduled", {
  toolIntentId: ToolIntentId;
  action: string;
  effectDigest: string;
}>;
export type RecordToolSucceeded = BaseCommand<"RecordToolSucceeded", {
  toolIntentId: ToolIntentId;
  effectDigest: string;
  outcomeReference: string;
  nextStatus: "Active" | "AwaitingUser" | "Resolved";
}>;
export type RecordToolFailed = BaseCommand<"RecordToolFailed", {
  toolIntentId: ToolIntentId;
  effectDigest: string;
  reasonCode: string;
  recoverable: boolean;
}>;
export type RequestHumanHandoff = BaseCommand<"RequestHumanHandoff", {
  handoffId: HandoffId;
  reason: string;
  urgency: HandoffUrgency;
  targetQueueReference: string;
  responseDeadline: string | null;
}>;
export type AcceptHumanHandoff = BaseCommand<"AcceptHumanHandoff", {
  handoffId: HandoffId;
  assigneeReference: string;
}>;
export type ResolveHumanHandoff = BaseCommand<"ResolveHumanHandoff", {
  handoffId: HandoffId;
  resolution: string;
  nextStatus: "Active" | "Resolved";
}>;
export type ResumeAutomation = BaseCommand<"ResumeAutomation", {
  freshDelegationReference: DelegationReference;
  aiActorReference: string;
}>;
export type AssignConversation = BaseCommand<"AssignConversation", {
  owner: ConversationOwner;
}>;
export type RecordBookingIntent = BaseCommand<"RecordBookingIntent", {
  operation: BookingOperation;
}>;
export type UpdateBookingProgress = BaseCommand<"UpdateBookingProgress", {
  patch: BookingProgressPatch;
}>;
export type RecordReactivationResponse = BaseCommand<"RecordReactivationResponse", {
  campaignReference: string;
  outreachSequenceReference: string;
  response: ReactivationResponse;
}>;
export type ResolveConversation = BaseCommand<"ResolveConversation", { reason: string }>;
export type CloseConversation = BaseCommand<"CloseConversation", { reason: string }>;
export type ReopenConversation = BaseCommand<"ReopenConversation", {
  reason: string;
  owner: ConversationOwner;
}>;
export type MarkConversationFailed = BaseCommand<"MarkConversationFailed", {
  failureCode: string;
  recoverable: boolean;
}>;
export type RecoverConversation = BaseCommand<"RecoverConversation", {
  reason: string;
  owner: ConversationOwner;
}>;

export type ConversationCommand =
  | StartConversation
  | RecordInboundMessage
  | RecordOutboundMessage
  | MarkAwaitingUser
  | ProposeToolAction
  | RequestConfirmation
  | RecordPatientConfirmation
  | RejectPatientConfirmation
  | RecordToolScheduled
  | RecordToolSucceeded
  | RecordToolFailed
  | RequestHumanHandoff
  | AcceptHumanHandoff
  | ResolveHumanHandoff
  | ResumeAutomation
  | AssignConversation
  | RecordBookingIntent
  | UpdateBookingProgress
  | RecordReactivationResponse
  | ResolveConversation
  | CloseConversation
  | ReopenConversation
  | MarkConversationFailed
  | RecoverConversation;

export const requiredCapabilityForCommand = (
  command: ConversationCommand,
): ConversationCapability => {
  switch (command.type) {
    case "StartConversation": return "conversation.start";
    case "RecordInboundMessage": return "conversation.message.record_inbound";
    case "RecordOutboundMessage": return "conversation.message.record_outbound";
    case "MarkAwaitingUser": return "conversation.await_user";
    case "ProposeToolAction": return "tool.propose";
    case "RequestConfirmation": return "booking.confirmation.request";
    case "RecordPatientConfirmation":
    case "RejectPatientConfirmation": return "booking.confirmation.record";
    case "RecordToolScheduled":
    case "RecordToolSucceeded":
    case "RecordToolFailed": return "tool.result.record";
    case "RequestHumanHandoff": return "handoff.request";
    case "AcceptHumanHandoff": return "handoff.accept";
    case "ResolveHumanHandoff": return "handoff.resolve";
    case "ResumeAutomation": return "automation.resume";
    case "AssignConversation": return "conversation.assign";
    case "RecordBookingIntent": return "booking.intent.record";
    case "UpdateBookingProgress": return "booking.progress.update";
    case "RecordReactivationResponse": return "reactivation.response.record";
    case "ResolveConversation": return "conversation.resolve";
    case "CloseConversation": return "conversation.close";
    case "ReopenConversation": return "conversation.reopen";
    case "MarkConversationFailed": return "conversation.fail";
    case "RecoverConversation": return "conversation.recover";
  }
};
