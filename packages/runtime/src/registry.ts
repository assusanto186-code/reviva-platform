import {
  createToolRegistry,
  type ToolRegistry,
} from "@reviva/conversation";

import type {
  RuntimeToolDescriptor,
  RuntimeToolRegistration,
  RuntimeToolRegistry,
  ToolHandler,
} from "./contracts.js";
import { runtimeHandlerIdentifier } from "./identifiers.js";
import { deepFreeze } from "./internal/immutable.js";

export class InvalidRuntimeToolRegistration extends Error {
  readonly code = "InvalidRuntimeToolRegistration" as const;

  constructor(readonly reason: string) {
    super(`Runtime tool registration is invalid: ${reason}.`);
    this.name = "InvalidRuntimeToolRegistration";
  }
}

export class DuplicateRuntimeToolRegistration extends Error {
  readonly code = "DuplicateRuntimeToolRegistration" as const;

  constructor(readonly reason: string) {
    super(`Runtime tool registration is duplicated: ${reason}.`);
    this.name = "DuplicateRuntimeToolRegistration";
  }
}

const descriptorKeys = Object.freeze([
  "tool",
  "handlerIdentifier",
  "executionMode",
  "idempotency",
  "timeoutClass",
  "effectClassification",
  "resultSchema",
]);
const safeSchema = /^[a-z][a-z0-9._-]{0,127}$/u;

class ClosedRuntimeToolRegistry implements RuntimeToolRegistry {
  readonly #registrations: readonly RuntimeToolRegistration[];
  readonly #conversationRegistry: ToolRegistry;

  constructor(registrations: readonly RuntimeToolRegistration[]) {
    const toolKeys = new Set<string>();
    const toolNames = new Set<string>();
    for (const registration of registrations) {
      const identifierKey =
        `${registration.descriptor.tool.identifier}@${registration.descriptor.tool.version}`;
      const nameKey =
        `${registration.descriptor.tool.name}@${registration.descriptor.tool.version}`;
      if (toolKeys.has(identifierKey)) {
        throw new DuplicateRuntimeToolRegistration("tool_identifier");
      }
      if (toolNames.has(nameKey)) {
        throw new DuplicateRuntimeToolRegistration("tool_name");
      }
      toolKeys.add(identifierKey);
      toolNames.add(nameKey);
    }
    const conversationRegistry = createToolRegistry(
      registrations.map((registration) => registration.descriptor.tool),
    );
    const validated: RuntimeToolRegistration[] = [];
    const handlerIds = new Set<string>();

    for (const registration of registrations) {
      const descriptor = registration.descriptor;
      const handler = registration.handler;
      try {
        runtimeHandlerIdentifier(descriptor.handlerIdentifier);
      } catch {
        throw new InvalidRuntimeToolRegistration("handler_identifier");
      }
      if (
        Object.keys(descriptor).length !== descriptorKeys.length ||
        Object.keys(descriptor).some((key) => !descriptorKeys.includes(key)) ||
        !safeSchema.test(descriptor.resultSchema) ||
        handler.identifier !== descriptor.handlerIdentifier ||
        handler.toolIdentifier !== descriptor.tool.identifier ||
        handler.toolVersion !== descriptor.tool.version
      ) {
        throw new InvalidRuntimeToolRegistration("descriptor_handler_mismatch");
      }
      if (
        (descriptor.effectClassification === "LocalTransactional" &&
          descriptor.executionMode !== "single_transaction") ||
        (descriptor.effectClassification === "DeferredExternal" &&
          descriptor.executionMode !== "deferred_outbox") ||
        (descriptor.effectClassification === "SynchronousExternal" &&
          descriptor.executionMode !== "synchronous_external") ||
        (descriptor.effectClassification !== "LocalTransactional" &&
          descriptor.idempotency !== "required") ||
        (descriptor.tool.effect === "mutating" &&
          descriptor.idempotency !== "required")
      ) {
        throw new InvalidRuntimeToolRegistration("effect_policy_mismatch");
      }
      if (handlerIds.has(handler.identifier)) {
        throw new DuplicateRuntimeToolRegistration("handler_identifier");
      }
      handlerIds.add(handler.identifier);
      const canonicalTool = conversationRegistry.findByIdentifier(
        descriptor.tool.identifier,
        descriptor.tool.version,
      );
      if (!canonicalTool.ok) {
        throw new InvalidRuntimeToolRegistration("tool_not_canonical");
      }
      validated.push(
        deepFreeze({
          descriptor: deepFreeze({
            ...descriptor,
            tool: canonicalTool.value,
          }),
          handler,
        }),
      );
    }

    this.#conversationRegistry = conversationRegistry;
    this.#registrations = deepFreeze(
      [...validated].sort((left, right) =>
        `${left.descriptor.tool.identifier}@${left.descriptor.tool.version}`.localeCompare(
          `${right.descriptor.tool.identifier}@${right.descriptor.tool.version}`,
        ),
      ),
    );
    Object.freeze(this);
  }

  find(toolIdentifier: string, version: string) {
    const registration = this.#registrations.find(
      (candidate) =>
        candidate.descriptor.tool.identifier === toolIdentifier &&
        candidate.descriptor.tool.version === version,
    );
    return registration === undefined
      ? deepFreeze({
          found: false as const,
          failure: { code: "RuntimeToolNotRegistered" as const },
        })
      : deepFreeze({
          found: true as const,
          descriptor: registration.descriptor,
        });
  }

  list(): readonly RuntimeToolDescriptor[] {
    return deepFreeze(
      this.#registrations.map((registration) => registration.descriptor),
    );
  }

  static resolveHandler(
    registry: ClosedRuntimeToolRegistry,
    toolIdentifier: string,
    version: string,
  ): ToolHandler | null {
    return (
      registry.#registrations.find(
        (candidate) =>
          candidate.descriptor.tool.identifier === toolIdentifier &&
          candidate.descriptor.tool.version === version,
      )?.handler ?? null
    );
  }

  static conversationRegistry(
    registry: ClosedRuntimeToolRegistry,
  ): ToolRegistry {
    return registry.#conversationRegistry;
  }
}

export const createRuntimeToolRegistry = (
  registrations: readonly RuntimeToolRegistration[],
): RuntimeToolRegistry => new ClosedRuntimeToolRegistry(registrations);

export const resolveRuntimeHandler = (
  registry: RuntimeToolRegistry,
  toolIdentifier: string,
  version: string,
): ToolHandler | null => {
  if (!(registry instanceof ClosedRuntimeToolRegistry)) {
    throw new InvalidRuntimeToolRegistration("foreign_registry");
  }
  return ClosedRuntimeToolRegistry.resolveHandler(
    registry,
    toolIdentifier,
    version,
  );
};

export const runtimeConversationToolRegistry = (
  registry: RuntimeToolRegistry,
): ToolRegistry => {
  if (!(registry instanceof ClosedRuntimeToolRegistry)) {
    throw new InvalidRuntimeToolRegistration("foreign_registry");
  }
  return ClosedRuntimeToolRegistry.conversationRegistry(registry);
};
