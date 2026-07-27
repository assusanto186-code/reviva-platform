import type { Conversation } from "../aggregate/conversation.js";
import type { ConversationEvent } from "../events/events.js";
import { applyConversationEvent } from "../state-machine/apply-event.js";
import {
  ConversationStreamNotFound,
  SnapshotIncompatible,
} from "./failures.js";
import {
  hasValidSnapshotIntegrity,
  type ConversationSnapshot,
} from "./models.js";

export const restoreConversationFromSnapshot = (
  snapshot: ConversationSnapshot,
  subsequentEvents: readonly ConversationEvent[],
  streamVersion: number,
): Conversation => {
  if (snapshot.schemaVersion !== 1) {
    throw new SnapshotIncompatible("unsupported_schema_version");
  }
  if (
    snapshot.aggregateVersion !== snapshot.projection.version ||
    snapshot.conversationId !== snapshot.projection.id ||
    snapshot.tenantId !== snapshot.projection.tenantId
  ) {
    throw new SnapshotIncompatible("projection_identity_or_version_mismatch");
  }
  if (snapshot.aggregateVersion > streamVersion) {
    throw new SnapshotIncompatible("snapshot_ahead_of_stream");
  }
  if (!hasValidSnapshotIntegrity(snapshot)) {
    throw new SnapshotIncompatible("integrity_mismatch");
  }

  let projection = snapshot.projection;
  let expectedSequence = snapshot.aggregateVersion + 1;
  for (const event of subsequentEvents) {
    if (
      event.tenantId !== snapshot.tenantId ||
      event.conversationId !== snapshot.conversationId ||
      event.sequence !== expectedSequence
    ) {
      throw new SnapshotIncompatible("invalid_subsequent_event_sequence");
    }
    const applied = applyConversationEvent(projection, event);
    if (!applied.ok) {
      throw new SnapshotIncompatible(applied.failure.code);
    }
    projection = applied.value;
    expectedSequence += 1;
  }

  if (projection.version !== streamVersion) {
    throw new ConversationStreamNotFound();
  }
  return projection;
};
