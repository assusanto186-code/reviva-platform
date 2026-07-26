import {
  capabilities,
  createCapabilitySet,
  createToolRegistry,
  toolIdentifier,
} from "../dist/index.js";
import { createFixture } from "./fixtures.mjs";

export const createAuthorizationFixture = () => {
  const domain = createFixture();
  const conversation = domain.activate();
  const all = createCapabilitySet(capabilities);

  const context = (overrides = {}) => {
    const actor = overrides.actor ?? {
      kind: "Staff",
      actorReference: "staff-a",
      authenticatedPrincipalReference: "principal-a",
    };
    const membership = overrides.membership ??
      (actor.kind === "Staff" || actor.kind === "HumanOperator"
        ? { status: "active", role: "manager" }
        : { status: "not_applicable", role: null });
    const selectedConversation = overrides.conversation ?? conversation;

    return {
      actor,
      tenantId: domain.tenant,
      locationId: domain.location,
      membership,
      globalAuthority: all,
      subscriptionAuthority: all,
      tenantAuthority: all,
      locationAuthority: { mode: "restricted", capabilities: all },
      actorAuthority: all,
      delegation: { status: "not_required" },
      conversation: selectedConversation,
      participation: "owner",
      confirmation: { status: "not_required", effectDigest: null },
      humanApproval: {
        status: "not_required",
        effectDigest: null,
        approverReference: null,
      },
      reactivationCommunicationBasis: "approved",
      requestedCapability: "conversation.read",
      requestedToolIdentifier: null,
      effectDigest: null,
      ...overrides,
      actor,
      membership,
      conversation: selectedConversation,
    };
  };

  const aiContext = (capability, overrides = {}) =>
    context({
      actor: {
        kind: "AiAgent",
        actorReference: "emma",
        authenticatedPrincipalReference: null,
      },
      membership: { status: "not_applicable", role: null },
      delegation: {
        status: "active",
        reference: "delegation-a",
        capabilities: all,
        toolIdentifiers: ["availability.lookup", "booking.create"],
        issuedForConversationVersion: conversation.version,
      },
      requestedCapability: capability,
      ...overrides,
    });

  const descriptor = (overrides = {}) => ({
    identifier: toolIdentifier("availability.lookup"),
    name: "availability.lookup",
    version: "1.0.0",
    description: "Read bounded availability.",
    requiredCapability: "booking.availability.read",
    allowedActorKinds: ["Staff", "HumanOperator", "AiAgent"],
    confirmation: "never",
    humanApproval: "never",
    effect: "read_only",
    inputContract: "availability.request.v1",
    outputContract: "availability.response.v1",
    ...overrides,
  });

  const registry = (...descriptors) =>
    createToolRegistry(descriptors.length > 0 ? descriptors : [descriptor()]);

  return {
    ...domain,
    conversation,
    all,
    context,
    aiContext,
    descriptor,
    registry,
  };
};
