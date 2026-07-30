import {
  toolIdentifier,
  type ActorContext,
  type ConversationCommand,
  type ToolDescriptor,
} from "@reviva/conversation";

import type {
  HandlerContext,
  HandlerResult,
  RuntimeToolRegistration,
  ToolHandler,
} from "../contracts.js";
import { runtimeHandlerIdentifier } from "../identifiers.js";
import { deepFreeze } from "../internal/immutable.js";

const plainRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const exactStringArguments = (
  value: unknown,
  required: readonly string[],
): boolean =>
  plainRecord(value) &&
  Object.keys(value).length === required.length &&
  Object.keys(value).every((key) => required.includes(key)) &&
  required.every(
    (key) =>
      typeof value[key] === "string" &&
      (value[key] as string).trim().length > 0,
  );

const runtimeActor = (context: HandlerContext): ActorContext => {
  const delegation = context.request.authorizationContext.delegation;
  return deepFreeze({
    kind: context.request.actor.kind,
    actorReference: context.request.actor.actorReference,
    authenticatedPrincipalReference:
      context.request.authorizationContext.actor
        .authenticatedPrincipalReference,
    delegationReference:
      delegation.status === "active"
        ? {
            id: delegation.reference,
            issuedForConversationVersion:
              delegation.issuedForConversationVersion,
          }
        : null,
    tenantId: context.request.tenantId,
    correlationId: context.request.correlationId,
    causationId: context.request.causationId,
  });
};

class BookingCreationHandler implements ToolHandler {
  readonly identifier = runtimeHandlerIdentifier(
    "booking.create.deferred.v1",
  );
  readonly toolIdentifier = toolIdentifier("booking.create");
  readonly toolVersion = "1";

  handle(context: HandlerContext): HandlerResult {
    if (
      !exactStringArguments(context.arguments, [
        "locationReference",
        "startTime",
      ])
    ) {
      return deepFreeze({
        status: "ValidationFailed",
        reasonCode: "booking_create_arguments_invalid",
        safeResult: null,
        conversationCommand: null,
      });
    }
    const command: ConversationCommand = deepFreeze({
      type: "RecordToolScheduled",
      commandId: context.request.artifacts.commandId,
      eventId: context.request.artifacts.eventId,
      conversationId: context.request.conversationId,
      expectedVersion: context.conversation.version,
      actor: runtimeActor(context),
      requestedAt: context.occurredAt,
      correlationId: context.request.correlationId,
      causationId: context.request.causationId,
      payload: {
        toolIntentId: context.request.artifacts.toolIntentId,
        action: "booking.create",
        effectDigest:
          context.request.validatedToolProposal.effectDigest,
      },
    });
    return deepFreeze({
      status: "ExternalEffectDeferred",
      safeResult: {
        deliveryStatus: "pending",
        operation: "booking.create",
      },
      conversationCommand: command,
      deferredEffect: {
        destination: "booking_gateway",
        payload: {
          operation: "booking.create",
          arguments: context.arguments,
        },
        deliveryPolicy: {
          maximumAttempts: 3,
          orderingRequired: true,
        },
      },
    });
  }
}

class BookingCancellationRequestHandler implements ToolHandler {
  readonly identifier = runtimeHandlerIdentifier(
    "booking.cancel.request.deferred.v1",
  );
  readonly toolIdentifier = toolIdentifier("booking.cancel");
  readonly toolVersion = "1";

  handle(context: HandlerContext): HandlerResult {
    if (
      !exactStringArguments(context.arguments, [
        "bookingReference",
        "reasonCode",
      ])
    ) {
      return deepFreeze({
        status: "ValidationFailed",
        reasonCode: "booking_cancellation_arguments_invalid",
        safeResult: null,
        conversationCommand: null,
      });
    }
    return deepFreeze({
      status: "ExternalEffectDeferred",
      safeResult: {
        deliveryStatus: "pending",
        operation: "booking.cancel.request",
      },
      conversationCommand: null,
      deferredEffect: {
        destination: "booking_gateway",
        payload: {
          operation: "booking.cancel.request",
          arguments: context.arguments,
        },
        deliveryPolicy: {
          maximumAttempts: 1,
          orderingRequired: true,
        },
      },
    });
  }
}

const bookingCreateDescriptor: ToolDescriptor = {
  identifier: toolIdentifier("booking.create"),
  name: "booking.create",
  version: "1",
  description: "Defer creation of a patient-confirmed booking.",
  requiredCapability: "booking.create",
  allowedActorKinds: ["AiAgent", "Staff", "HumanOperator"],
  confirmation: "required",
  humanApproval: "never",
  effect: "mutating",
  inputContract: "booking.create.input.v1",
  outputContract: "booking.create.output.v1",
};

const bookingCancellationDescriptor: ToolDescriptor = {
  identifier: toolIdentifier("booking.cancel"),
  name: "booking.cancel",
  version: "1",
  description: "Defer an operator-approved booking cancellation request.",
  requiredCapability: "booking.cancel.request",
  allowedActorKinds: ["Staff", "HumanOperator"],
  confirmation: "never",
  humanApproval: "required",
  effect: "mutating",
  inputContract: "booking.cancel.input.v1",
  outputContract: "booking.cancel.request.output.v1",
};

export const createReleaseRuntimeRegistrations =
  (): readonly RuntimeToolRegistration[] =>
    deepFreeze([
      {
        descriptor: {
          tool: bookingCreateDescriptor,
          handlerIdentifier: runtimeHandlerIdentifier(
            "booking.create.deferred.v1",
          ),
          executionMode: "deferred_outbox",
          idempotency: "required",
          timeoutClass: "standard",
          effectClassification: "DeferredExternal",
          resultSchema: "booking.create.runtime-result.v1",
        },
        handler: new BookingCreationHandler(),
      },
      {
        descriptor: {
          tool: bookingCancellationDescriptor,
          handlerIdentifier: runtimeHandlerIdentifier(
            "booking.cancel.request.deferred.v1",
          ),
          executionMode: "deferred_outbox",
          idempotency: "required",
          timeoutClass: "standard",
          effectClassification: "DeferredExternal",
          resultSchema: "booking.cancel.runtime-result.v1",
        },
        handler: new BookingCancellationRequestHandler(),
      },
    ]);

class ScriptedRuntimeHandler implements ToolHandler {
  #cursor = 0;

  constructor(
    readonly identifier: ToolHandler["identifier"],
    readonly toolIdentifier: ToolHandler["toolIdentifier"],
    readonly toolVersion: string,
    private readonly results: readonly HandlerResult[],
  ) {}

  get invocationCount(): number {
    return this.#cursor;
  }

  handle(): HandlerResult {
    const result = this.results[this.#cursor];
    if (result === undefined) {
      throw new Error("scripted_runtime_handler_exhausted");
    }
    this.#cursor += 1;
    return result;
  }
}

export type ScriptedRuntimeHandlerControl = Readonly<{
  handler: ToolHandler;
  invocationCount(): number;
}>;

export const createScriptedRuntimeHandler = (
  identifier: string,
  descriptor: ToolDescriptor,
  results: readonly HandlerResult[],
): ScriptedRuntimeHandlerControl => {
  const handler = new ScriptedRuntimeHandler(
    runtimeHandlerIdentifier(identifier),
    descriptor.identifier,
    descriptor.version,
    deepFreeze([...results]),
  );
  return Object.freeze({
    handler,
    invocationCount: () => handler.invocationCount,
  });
};
