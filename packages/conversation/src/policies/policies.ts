import type { Conversation } from "../aggregate/conversation.js";
import type { BookingProgress, BookingProgressPatch } from "../booking/booking.js";
import { autonomousAiForbiddenStatuses } from "../state-machine/states.js";

const requiredBookingFields = ["service", "location", "slot", "contact"] as const;

export const isBookingSummaryComplete = (booking: BookingProgress): boolean =>
  requiredBookingFields.every((field) => {
    const value = booking[field];
    return value.value !== null && (value.status === "proposed" || value.status === "confirmed");
  });

export const hasCurrentBookingConfirmation = (
  booking: BookingProgress,
  effectDigest: string,
): boolean =>
  booking.confirmation.status === "confirmed" &&
  booking.confirmation.effectDigest === effectDigest;

export const bookingPatchInvalidatesConfirmation = (
  booking: BookingProgress,
  patch: BookingProgressPatch,
): boolean => {
  if (booking.confirmation.status !== "confirmed") return false;

  return Object.entries(patch).some(([key, value]) => {
    if (value === undefined) return false;
    const current = booking[key as keyof BookingProgressPatch];
    return current?.status !== value.status || current.value !== value.value;
  });
};

export const isAutonomousAiEffectEligible = (conversation: Conversation): boolean =>
  !autonomousAiForbiddenStatuses.some((status) => status === conversation.status) &&
  conversation.reactivation?.response !== "opted_out";

export const canReopenConversation = (conversation: Conversation): boolean =>
  conversation.status === "Resolved" || conversation.status === "Closed";
