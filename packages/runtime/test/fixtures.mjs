import {
  auditEntryId,
  capabilities,
  commandId,
  conversationEventId,
  correlationId,
  createCapabilitySet,
  expectedVersion,
  handoffId,
  idempotencyKey,
  operationId,
  outboxMessageId,
  participantId,
  resultReference,
  toolIntentId,
  transactionId,
} from "@reviva/conversation";
import { executionId } from "@reviva/execution";
import {
  createRuntimeComposition,
  createRuntimeExecutionRequest,
  createRuntimeToolRegistry,
  handoffTransitionId,
  runtimeExecutionId,
  runtimeRequestFingerprint,
} from "../dist/index.js";
import {
  createReleaseRuntimeRegistrations,
} from "../dist/reference/handlers.js";
import {
  createInMemoryRuntimePersistence,
} from "../dist/reference/in-memory.js";
import { createFixture } from "../../conversation/test/fixtures.mjs";

export const effectDigest = `sha256:${"a".repeat(64)}`;
export const otherEffectDigest = `sha256:${"b".repeat(64)}`;

const capture = (fixture, result, events) => {
  const value = fixture.expectSuccess(result);
  events.push(...value.events);
  return value.conversation;
};

export const buildConversationHistory = ({
  digest = effectDigest,
  handedOff = false,
} = {}) => {
  const fixture = createFixture();
  const events = [];
  let current = capture(
    fixture,
    fixture.run(null, "StartConversation", {
      tenantId: fixture.tenant,
      locationId: fixture.location,
      channel: "web",
      participants: [{
        id: participantId("participant-runtime"),
        kind: "Patient",
        actorReference: "patient-runtime",
        joinedAt: "2026-07-29T00:00:00.000Z",
      }],
      contactId: fixture.contact,
      initialOwner: { kind: "ai", actorReference: "emma-runtime" },
    }),
    events,
  );
  current = capture(
    fixture,
    fixture.run(current, "RecordInboundMessage", {
      messageId: fixture.ids.messageId("message-runtime"),
      author: fixture.actor("Patient"),
      content: "I would like the confirmed appointment.",
      externalMessageReference: "message-reference-runtime",
      receivedAt: "2026-07-29T00:01:00.000Z",
    }, { kind: "Patient" }),
    events,
  );
  current = capture(
    fixture,
    fixture.run(current, "RecordBookingIntent", { operation: "create" }),
    events,
  );
  current = capture(
    fixture,
    fixture.run(current, "UpdateBookingProgress", {
      patch: {
        service: { status: "proposed", value: "facial" },
        location: { status: "proposed", value: "location-a" },
        practitioner: { status: "proposed", value: "practitioner-a" },
        slot: { status: "proposed", value: "slot-a" },
        contact: { status: "proposed", value: fixture.contact },
        priceOrDeposit: { status: "proposed", value: "$100" },
      },
    }),
    events,
  );
  current = capture(
    fixture,
    fixture.run(current, "RequestConfirmation", {
      effectDigest: digest,
      summaryReference: "summary-runtime",
    }, { kind: "AiAgent", delegationVersion: current.version }),
    events,
  );
  current = capture(
    fixture,
    fixture.run(current, "RecordPatientConfirmation", {
      effectDigest: digest,
    }, { kind: "Patient" }),
    events,
  );
  if (handedOff) {
    current = capture(
      fixture,
      fixture.run(current, "RequestHumanHandoff", {
        handoffId: handoffId("handoff-conversation-runtime"),
        reason: "patient_requested_human",
        urgency: "Normal",
        targetQueueReference: "queue-front-desk",
        responseDeadline: null,
      }),
      events,
    );
  }
  return { fixture, events, conversation: current };
};

export const seedConversation = async (
  persistence,
  history,
  serial = "seed",
) => {
  await persistence.transactionManager.runInTransaction(
    {
      id: transactionId(`transaction-${serial}`),
      tenantId: history.conversation.tenantId,
    },
    async (transaction) => {
      await persistence.events.append(
        transaction,
        history.conversation.tenantId,
        history.conversation.id,
        expectedVersion(0),
        history.events,
      );
      await persistence.projections.save(
        transaction,
        history.conversation,
        expectedVersion(0),
      );
    },
  );
};

export const createRuntimeFixture = async (options = {}) => {
  const history = buildConversationHistory(options);
  const persistence = createInMemoryRuntimePersistence();
  await seedConversation(persistence, history);
  const registrations =
    options.registrations ?? createReleaseRuntimeRegistrations();
  const registry = createRuntimeToolRegistry(registrations);
  const composition = createRuntimeComposition({ registry, persistence });
  let serial = 0;

  const input = (overrides = {}) => {
    serial += 1;
    const descriptor =
      overrides.descriptor ??
      registry.find(
        overrides.toolIdentifier ?? "booking.create",
        overrides.toolVersion ?? "1",
      ).descriptor;
    const actorKind = overrides.actorKind ?? "AiAgent";
    const actorReference =
      overrides.actorReference ??
      (actorKind === "AiAgent" ? "emma-runtime" : "operator-runtime");
    const corr = correlationId(`correlation-runtime-${serial}`);
    const all = createCapabilitySet(capabilities);
    const proposal = {
      schemaVersion: 1,
      toolIdentifier: descriptor.tool.identifier,
      toolVersion: descriptor.tool.version,
      requiredCapability: descriptor.tool.requiredCapability,
      arguments:
        overrides.arguments ??
        (descriptor.tool.identifier === "booking.cancel"
          ? {
              bookingReference: "booking-runtime",
              reasonCode: "patient_request",
            }
          : {
              locationReference: "location-a",
              startTime: "2026-08-01T10:00:00.000Z",
            }),
      effectDigest: overrides.effectDigest ?? effectDigest,
      confirmationStatus:
        descriptor.tool.confirmation === "required"
          ? "required"
          : "not_required",
      humanApprovalStatus:
        descriptor.tool.humanApproval === "required"
          ? "required"
          : "not_required",
      correlationId: corr,
      sourceExecutionId: executionId(`execution-runtime-${serial}`),
      ...(overrides.proposal ?? {}),
    };
    const current = history.conversation;
    const membership =
      actorKind === "Staff" || actorKind === "HumanOperator"
        ? { status: "active", role: "manager" }
        : { status: "not_applicable", role: null };
    const activeDelegation = {
      status: "active",
      reference: `delegation-runtime-${serial}`,
      capabilities: all,
      toolIdentifiers: [descriptor.tool.identifier],
      issuedForConversationVersion: current.version,
    };
    const domainConfirmation =
      descriptor.tool.confirmation === "required"
        ? { status: "current", effectDigest: proposal.effectDigest }
        : { status: "not_required", effectDigest: null };
    const domainApproval =
      descriptor.tool.humanApproval === "required"
        ? {
            status: "current",
            effectDigest: proposal.effectDigest,
            approverReference: "operator-approver",
          }
        : {
            status: "not_required",
            effectDigest: null,
            approverReference: null,
          };
    const authorizationContext = {
      actor: {
        kind: actorKind,
        actorReference,
        authenticatedPrincipalReference:
          actorKind === "Staff" || actorKind === "HumanOperator"
            ? "principal-runtime"
            : null,
      },
      tenantId: current.tenantId,
      locationId: current.locationId,
      membership,
      globalAuthority: all,
      subscriptionAuthority: all,
      tenantAuthority: all,
      locationAuthority: {
        mode: "restricted",
        capabilities: all,
      },
      actorAuthority: overrides.actorAuthority ?? all,
      delegation:
        actorKind === "AiAgent"
          ? (overrides.delegation ?? activeDelegation)
          : { status: "not_required" },
      conversation: current,
      participation: "owner",
      confirmation: domainConfirmation,
      humanApproval: domainApproval,
      reactivationCommunicationBasis: "approved",
      requestedCapability: descriptor.tool.requiredCapability,
      requestedToolIdentifier: descriptor.tool.identifier,
      effectDigest: proposal.effectDigest,
      ...(overrides.authorizationContext ?? {}),
    };
    const confirmationEvidence =
      descriptor.tool.confirmation === "required"
        ? {
            status: "current",
            tenantId: current.tenantId,
            conversationId: current.id,
            actorReference,
            effectDigest: proposal.effectDigest,
            conversationVersion: current.version,
            correlationId: corr,
            recordedAt: "2026-07-29T00:10:00.000Z",
            expiresAt: "2026-07-29T00:20:00.000Z",
          }
        : { status: "not_required" };
    const approvalEvidence =
      descriptor.tool.humanApproval === "required"
        ? {
            status: "current",
            tenantId: current.tenantId,
            conversationId: current.id,
            actorReference,
            effectDigest: proposal.effectDigest,
            conversationVersion: current.version,
            correlationId: corr,
            recordedAt: "2026-07-29T00:10:00.000Z",
            expiresAt: "2026-07-29T00:20:00.000Z",
            approverReference: "operator-approver",
          }
        : { status: "not_required" };
    const draft = {
      schemaVersion: 1,
      runtimeExecutionId: runtimeExecutionId(
        `runtime-execution-${serial}`,
      ),
      tenantId: current.tenantId,
      conversationId: current.id,
      actor: { actorReference, kind: actorKind },
      correlationId: corr,
      causationId: null,
      expectedConversationVersion: current.version,
      currentConversationState: current.status,
      authorizationContext,
      validatedToolProposal: proposal,
      confirmationEvidence:
        overrides.confirmationEvidence ?? confirmationEvidence,
      humanApprovalEvidence:
        overrides.humanApprovalEvidence ?? approvalEvidence,
      idempotencyKey: idempotencyKey(`runtime-key-${serial}`),
      idempotencyFingerprint: "",
      transaction: {
        transactionId: transactionId(`runtime-transaction-${serial}`),
        operationId: operationId(
          `runtime.${descriptor.tool.identifier}`,
        ),
        resultReference: resultReference(`runtime-result-${serial}`),
        requestedAt: "2026-07-29T00:15:00.000Z",
        timeoutMilliseconds: 5_000,
      },
      artifacts: {
        commandId: commandId(`runtime-command-${serial}`),
        eventId: conversationEventId(`runtime-event-${serial}`),
        toolIntentId: toolIntentId(`runtime-tool-intent-${serial}`),
        auditEntryId: auditEntryId(`runtime-audit-${serial}`),
        outboxMessageId:
          descriptor.effectClassification === "DeferredExternal"
            ? outboxMessageId(`runtime-outbox-${serial}`)
            : null,
      },
      ...(overrides.root ?? {}),
    };
    draft.idempotencyFingerprint = runtimeRequestFingerprint({
      tenantId: draft.tenantId,
      conversationId: draft.conversationId,
      actor: draft.actor,
      validatedToolProposal: draft.validatedToolProposal,
      operationId: draft.transaction.operationId,
    });
    if (overrides.idempotencyFingerprint !== undefined) {
      draft.idempotencyFingerprint = overrides.idempotencyFingerprint;
    }
    return draft;
  };

  const request = (overrides = {}) =>
    createRuntimeExecutionRequest(input(overrides));

  return {
    ...history,
    persistence,
    registry,
    composition,
    input,
    request,
    ids: {
      auditEntryId,
      handoffId,
      handoffTransitionId,
      transactionId,
    },
  };
};
