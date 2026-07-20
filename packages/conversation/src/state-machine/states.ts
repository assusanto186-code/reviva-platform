export const conversationStatuses = [
  "New",
  "Active",
  "AwaitingUser",
  "AwaitingTool",
  "AwaitingConfirmation",
  "AwaitingHuman",
  "HandedOff",
  "Resolved",
  "Closed",
  "Failed",
] as const;

export type ConversationStatus = (typeof conversationStatuses)[number];

export const activeConversationStatuses = ["Active"] as const;
export const waitingConversationStatuses = [
  "AwaitingUser",
  "AwaitingTool",
  "AwaitingConfirmation",
  "AwaitingHuman",
] as const;
export const terminalConversationStatuses = ["Closed"] as const;
export const reopenableConversationStatuses = ["Resolved", "Closed"] as const;
export const autonomousAiForbiddenStatuses = [
  "AwaitingHuman",
  "HandedOff",
  "Resolved",
  "Closed",
  "Failed",
] as const;
