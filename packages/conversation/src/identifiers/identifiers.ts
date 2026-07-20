declare const conversationIdentifier: unique symbol;

type ConversationIdentifier<Name extends string> = string & {
  readonly [conversationIdentifier]: Name;
};

export type ConversationId = ConversationIdentifier<"ConversationId">;
export type ConversationEventId = ConversationIdentifier<"ConversationEventId">;
export type MessageId = ConversationIdentifier<"MessageId">;
export type ParticipantId = ConversationIdentifier<"ParticipantId">;
export type ContactId = ConversationIdentifier<"ContactId">;
export type CommandId = ConversationIdentifier<"CommandId">;
export type CorrelationId = ConversationIdentifier<"CorrelationId">;
export type CausationId = ConversationIdentifier<"CausationId">;
export type HandoffId = ConversationIdentifier<"HandoffId">;
export type ToolIntentId = ConversationIdentifier<"ToolIntentId">;

export class InvalidConversationIdentifier extends Error {
  readonly code = "InvalidConversationIdentifier" as const;

  constructor(readonly identifierName: string) {
    super(`${identifierName} must contain 1 to 128 non-control characters.`);
    this.name = "InvalidConversationIdentifier";
  }
}

function createIdentifier<Name extends string>(value: string, name: Name) {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > 128 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new InvalidConversationIdentifier(name);
  }

  return normalized as ConversationIdentifier<Name>;
}

export const conversationId = (value: string) => createIdentifier(value, "ConversationId");
export const conversationEventId = (value: string) => createIdentifier(value, "ConversationEventId");
export const messageId = (value: string) => createIdentifier(value, "MessageId");
export const participantId = (value: string) => createIdentifier(value, "ParticipantId");
export const contactId = (value: string) => createIdentifier(value, "ContactId");
export const commandId = (value: string) => createIdentifier(value, "CommandId");
export const correlationId = (value: string) => createIdentifier(value, "CorrelationId");
export const causationId = (value: string) => createIdentifier(value, "CausationId");
export const handoffId = (value: string) => createIdentifier(value, "HandoffId");
export const toolIntentId = (value: string) => createIdentifier(value, "ToolIntentId");
