import type { LocationId, TenantId } from "@reviva/domain";

import type { BookingProgress } from "../booking/booking.js";
import type {
  ContactId,
  ConversationId,
  ToolIntentId,
} from "../identifiers/identifiers.js";
import type { HandoffState } from "../handoff/handoff.js";
import type { ConversationOwner, Participant } from "../participants/participants.js";
import type { ReactivationProgress } from "../reactivation/reactivation.js";
import type { ConversationStatus } from "../state-machine/states.js";

export type ConversationChannel = "web" | "sms" | "email" | "voice";

export type Conversation = Readonly<{
  id: ConversationId;
  tenantId: TenantId;
  locationId: LocationId | null;
  channel: ConversationChannel;
  participants: readonly Participant[];
  status: ConversationStatus;
  currentOwner: ConversationOwner;
  handoff: HandoffState | null;
  booking: BookingProgress | null;
  pendingTool: Readonly<{
    toolIntentId: ToolIntentId;
    action: string;
    effectDigest: string;
  }> | null;
  reactivation: ReactivationProgress | null;
  contactId: ContactId;
  version: number;
  lastCommittedSequence: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
  failure: Readonly<{ code: string; recoverable: boolean }> | null;
}>;
