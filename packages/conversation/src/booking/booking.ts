import type { ContactId } from "../identifiers/identifiers.js";

export type BookingFieldStatus = "unknown" | "proposed" | "confirmed" | "invalidated";

export type BookingField<T> = Readonly<{
  status: BookingFieldStatus;
  value: T | null;
}>;

export type BookingOperation = "create" | "modify" | "cancel";
export type BookingConfirmationStatus =
  | "not_requested"
  | "pending"
  | "confirmed"
  | "rejected"
  | "invalidated";

export type BookingConfirmation = Readonly<{
  status: BookingConfirmationStatus;
  effectDigest: string | null;
  confirmedAt: string | null;
  confirmedForVersion: number | null;
}>;

export type BookingProgress = Readonly<{
  operation: BookingOperation;
  service: BookingField<string>;
  location: BookingField<string>;
  practitioner: BookingField<string>;
  slot: BookingField<string>;
  contact: BookingField<ContactId>;
  priceOrDeposit: BookingField<string>;
  confirmation: BookingConfirmation;
}>;

export type BookingProgressPatch = Readonly<Partial<Pick<
  BookingProgress,
  "service" | "location" | "practitioner" | "slot" | "contact" | "priceOrDeposit"
>>>;

export const unknownBookingField = <T>(): BookingField<T> =>
  Object.freeze({ status: "unknown", value: null });

export const createBookingProgress = (operation: BookingOperation): BookingProgress =>
  Object.freeze({
    operation,
    service: unknownBookingField<string>(),
    location: unknownBookingField<string>(),
    practitioner: unknownBookingField<string>(),
    slot: unknownBookingField<string>(),
    contact: unknownBookingField<ContactId>(),
    priceOrDeposit: unknownBookingField<string>(),
    confirmation: Object.freeze({
      status: "not_requested",
      effectDigest: null,
      confirmedAt: null,
      confirmedForVersion: null,
    }),
  });
