import type { Conversation } from "../aggregate/conversation.js";
import type { ConversationEvent } from "../events/events.js";
import {
  conversationFailure,
  conversationSuccess,
  createConversationFailure,
  type ConversationResult,
} from "../failures/failures.js";
import { applyConversationEvent } from "../state-machine/apply-event.js";

export const rehydrateConversation = (
  events: readonly ConversationEvent[],
): ConversationResult<Conversation> => {
  if (events.length === 0) {
    return conversationFailure(
      createConversationFailure("InvalidEventSequence", {
        expectedInitialEvent: "ConversationStarted",
      }),
    );
  }

  const eventIds = new Set<string>();
  let projection: Conversation | null = null;

  for (const event of events) {
    if (eventIds.has(event.eventId)) {
      return conversationFailure(
        createConversationFailure("InvalidEventSequence", {
          reason: "duplicate_event_id",
          sequence: event.sequence,
        }),
      );
    }
    eventIds.add(event.eventId);

    const applied = applyConversationEvent(projection, event);
    if (!applied.ok) return applied;
    projection = applied.value;
  }

  return projection === null
    ? conversationFailure(createConversationFailure("InternalConversationInvariantFailure"))
    : conversationSuccess(projection);
};
