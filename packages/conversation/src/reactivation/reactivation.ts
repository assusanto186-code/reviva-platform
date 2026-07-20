export type ReactivationResponse =
  | "unknown"
  | "interested"
  | "not_interested"
  | "needs_human_assistance"
  | "converted_to_booking"
  | "opted_out";

export type ReactivationProgress = Readonly<{
  campaignReference: string;
  outreachSequenceReference: string;
  response: ReactivationResponse;
  optedOutAt: string | null;
}>;
