export const conversationFailureCodes = [
  "ConversationNotFound",
  "TenantMismatch",
  "InvalidCommand",
  "InvalidStateTransition",
  "ConcurrencyConflict",
  "DuplicateCommand",
  "DuplicateInboundMessage",
  "StaleConfirmation",
  "StaleToolResult",
  "StaleAiAction",
  "ConfirmationRequired",
  "HumanApprovalRequired",
  "HandoffRequired",
  "ConversationAlreadyClosed",
  "ConversationNotRecoverable",
  "UnsupportedEventVersion",
  "InvalidEventSequence",
  "InternalConversationInvariantFailure",
] as const;

export type ConversationFailureCode = (typeof conversationFailureCodes)[number];
export type SafeFailureContextValue = string | number | boolean | null;

export type ConversationFailure = Readonly<{
  code: ConversationFailureCode;
  retryable: boolean;
  context: Readonly<Record<string, SafeFailureContextValue>>;
}>;

const retryableFailures: ReadonlySet<ConversationFailureCode> = new Set([
  "ConcurrencyConflict",
]);

export const createConversationFailure = (
  code: ConversationFailureCode,
  context: Readonly<Record<string, SafeFailureContextValue>> = {},
): ConversationFailure =>
  Object.freeze({
    code,
    retryable: retryableFailures.has(code),
    context: Object.freeze({ ...context }),
  });

export type ConversationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; failure: ConversationFailure }>;

export const conversationSuccess = <T>(value: T): ConversationResult<T> =>
  Object.freeze({ ok: true, value });

export const conversationFailure = <T = never>(
  failure: ConversationFailure,
): ConversationResult<T> => Object.freeze({ ok: false, failure });
