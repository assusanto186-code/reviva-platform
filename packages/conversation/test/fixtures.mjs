import {
  commandId,
  contactId,
  conversationEventId,
  conversationId,
  correlationId,
  causationId,
  handoffId,
  handleConversationCommand,
  messageId,
  participantId,
  toolIntentId,
} from "../dist/index.js";
import { locationId, tenantId } from "@reviva/domain";

export const createFixture = () => {
  let serial = 0;
  const next = (prefix) => `${prefix}-${++serial}`;
  const tenant = tenantId("tenant-a");
  const otherTenant = tenantId("tenant-b");
  const location = locationId("location-a");
  const conversation = conversationId("conversation-a");
  const contact = contactId("contact-a");

  const actor = (kind, version = null, actorTenant = tenant, corr = correlationId(next("corr"))) => ({
    kind,
    actorReference: `${kind.toLowerCase()}-actor`,
    authenticatedPrincipalReference:
      kind === "Staff" || kind === "HumanOperator" ? `${kind.toLowerCase()}-principal` : null,
    delegationReference:
      kind === "AiAgent" && version !== null
        ? { id: next("delegation"), issuedForConversationVersion: version }
        : null,
    tenantId: actorTenant,
    correlationId: corr,
    causationId: null,
  });

  const command = (type, current, payload, options = {}) => {
    const corr = correlationId(next("correlation"));
    const cause = options.causationId ?? causationId(next("cause"));
    const commandActor = options.actor ?? actor(
      options.kind ?? "System",
      options.delegationVersion ?? null,
      options.tenant ?? tenant,
      corr,
    );
    return {
      type,
      commandId: commandId(next("command")),
      eventId: conversationEventId(next("event")),
      conversationId: options.conversationId ?? conversation,
      expectedVersion: options.expectedVersion ?? current?.version ?? 0,
      actor: { ...commandActor, correlationId: corr, causationId: cause },
      requestedAt: options.at ?? `2026-07-20T00:${String(serial % 60).padStart(2, "0")}:00.000Z`,
      correlationId: corr,
      causationId: cause,
      payload,
    };
  };

  const run = (current, type, payload, options = {}, context) =>
    handleConversationCommand(current, command(type, current, payload, options), context);

  const expectSuccess = (result) => {
    if (!result.ok) throw new Error(`Expected success, received ${result.failure.code}`);
    return result.value;
  };

  const start = () => expectSuccess(run(null, "StartConversation", {
    tenantId: tenant,
    locationId: location,
    channel: "web",
    participants: [{
      id: participantId("participant-a"),
      kind: "Patient",
      actorReference: "patient-a",
      joinedAt: "2026-07-20T00:00:00.000Z",
    }],
    contactId: contact,
    initialOwner: { kind: "ai", actorReference: "emma" },
  })).conversation;

  const activate = (current = start()) => expectSuccess(run(current, "RecordInboundMessage", {
    messageId: messageId(next("message")),
    author: actor("Patient"),
    content: "Hello",
    externalMessageReference: next("external"),
    receivedAt: "2026-07-20T00:01:00.000Z",
  }, { kind: "Patient" })).conversation;

  const bookingReady = (operation = "create") => {
    let current = activate();
    current = expectSuccess(run(current, "RecordBookingIntent", { operation })).conversation;
    current = expectSuccess(run(current, "UpdateBookingProgress", {
      patch: {
        service: { status: "proposed", value: "facial" },
        location: { status: "proposed", value: "location-a" },
        practitioner: { status: "proposed", value: "practitioner-a" },
        slot: { status: "proposed", value: "slot-a" },
        contact: { status: "proposed", value: contact },
        priceOrDeposit: { status: "proposed", value: "$100" },
      },
    })).conversation;
    return current;
  };

  const confirmedBooking = (operation = "create", digest = "effect-a") => {
    let current = bookingReady(operation);
    current = expectSuccess(run(current, "RequestConfirmation", {
      effectDigest: digest,
      summaryReference: "summary-a",
    }, { kind: "AiAgent", delegationVersion: current.version })).conversation;
    current = expectSuccess(run(current, "RecordPatientConfirmation", {
      effectDigest: digest,
    }, { kind: "Patient" })).conversation;
    return current;
  };

  return {
    actor,
    command,
    run,
    expectSuccess,
    start,
    activate,
    bookingReady,
    confirmedBooking,
    tenant,
    otherTenant,
    location,
    conversation,
    contact,
    next,
    ids: { handoffId, messageId, toolIntentId },
  };
};
