import type { CommandId, MessageId } from "../identifiers/identifiers.js";

export type KnownCommandOutcome = Readonly<{
  commandId: CommandId;
  resultingVersion: number;
  outcomeReference: string;
}>;

export type DuplicateCheck = Readonly<
  | { kind: "none" }
  | { kind: "command"; prior: KnownCommandOutcome }
  | { kind: "inbound_message"; messageId: MessageId }
>;

export type CommandHandlingContext = Readonly<{
  duplicate: DuplicateCheck;
}>;
