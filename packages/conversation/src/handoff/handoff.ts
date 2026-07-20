import type { HandoffId } from "../identifiers/identifiers.js";
import type { ActorContext } from "../participants/participants.js";

export type HandoffUrgency = "Normal" | "High" | "Urgent";
export type AiOperatingMode = "autonomous" | "paused" | "assist_only";

export type HandoffState = Readonly<{
  id: HandoffId;
  reason: string;
  urgency: HandoffUrgency;
  requestedAt: string;
  requestedBy: ActorContext;
  targetQueueReference: string;
  assigneeReference: string | null;
  acceptedAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  aiOperatingMode: AiOperatingMode;
  responseDeadline: string | null;
}>;
