import {
  actorKinds,
  type ActorKind,
} from "../participants/participants.js";
import {
  capability,
  type Capability,
} from "../capabilities/capability.js";
import { deepFreeze } from "../internal/immutable.js";
import {
  DuplicateToolIdentifier,
  DuplicateToolName,
  InvalidToolDescriptor,
  type UnknownTool,
} from "../authorization/authorization-failure.js";

declare const toolIdentifierBrand: unique symbol;
export type ToolIdentifier = string & { readonly [toolIdentifierBrand]: "ToolIdentifier" };

export type ToolDescriptor = Readonly<{
  identifier: ToolIdentifier;
  name: string;
  version: string;
  description: string;
  requiredCapability: Capability;
  allowedActorKinds: readonly ActorKind[];
  confirmation: "never" | "required";
  humanApproval: "never" | "required";
  effect: "read_only" | "mutating";
  inputContract: string;
  outputContract: string;
}>;

export type ToolLookupResult =
  | Readonly<{ ok: true; value: ToolDescriptor }>
  | Readonly<{ ok: false; failure: UnknownTool }>;

export type ToolRegistry = Readonly<{
  findByIdentifier(identifier: string, version: string): ToolLookupResult;
  findByName(name: string, version: string): ToolLookupResult;
  list(): readonly ToolDescriptor[];
}>;

const boundedToken = /^[a-z][a-z0-9._-]{0,127}$/u;
const boundedVersion = /^[0-9]+(?:\.[0-9]+){0,2}$/u;
const descriptorKeys: readonly string[] = Object.freeze([
  "identifier",
  "name",
  "version",
  "description",
  "requiredCapability",
  "allowedActorKinds",
  "confirmation",
  "humanApproval",
  "effect",
  "inputContract",
  "outputContract",
]);

export const toolIdentifier = (value: string): ToolIdentifier => {
  const normalized = value.trim();
  if (value !== normalized || !boundedToken.test(normalized)) {
    throw new InvalidToolDescriptor("invalid_identifier");
  }
  return normalized as ToolIdentifier;
};

const validateDescriptor = (candidate: ToolDescriptor): ToolDescriptor => {
  const unsafe = candidate as ToolDescriptor & Record<string, unknown>;
  if (
    Object.entries(unsafe).some(
      ([key, value]) =>
        !descriptorKeys.includes(key) || typeof value === "function",
    )
  ) {
    throw new InvalidToolDescriptor("unknown_or_executable_field");
  }

  if (
    !boundedToken.test(candidate.name) ||
    !boundedVersion.test(candidate.version) ||
    !candidate.description.trim() ||
    !candidate.inputContract.trim() ||
    !candidate.outputContract.trim() ||
    candidate.allowedActorKinds.length === 0 ||
    candidate.allowedActorKinds.some(
      (kind) => !actorKinds.includes(kind),
    )
  ) {
    throw new InvalidToolDescriptor("malformed_descriptor");
  }

  capability(candidate.requiredCapability);
  toolIdentifier(candidate.identifier);
  return deepFreeze({
    ...candidate,
    allowedActorKinds: [...new Set(candidate.allowedActorKinds)],
  });
};

export const createToolRegistry = (
  descriptors: readonly ToolDescriptor[],
): ToolRegistry => {
  const validated = descriptors.map(validateDescriptor);
  const identifiers = new Set<string>();
  const names = new Set<string>();

  for (const descriptor of validated) {
    const identifierKey = `${descriptor.identifier}@${descriptor.version}`;
    const nameKey = `${descriptor.name}@${descriptor.version}`;
    if (identifiers.has(identifierKey)) throw new DuplicateToolIdentifier();
    if (names.has(nameKey)) throw new DuplicateToolName();
    identifiers.add(identifierKey);
    names.add(nameKey);
  }

  const ordered = deepFreeze(
    [...validated].sort((left, right) =>
      `${left.identifier}@${left.version}`.localeCompare(
        `${right.identifier}@${right.version}`,
      )),
  );
  const unknown = (): ToolLookupResult =>
    deepFreeze({ ok: false, failure: { code: "UnknownTool" } });

  return Object.freeze({
    findByIdentifier(identifier: string, version: string): ToolLookupResult {
      const found = ordered.find(
        (item) => item.identifier === identifier && item.version === version,
      );
      return found ? deepFreeze({ ok: true, value: found }) : unknown();
    },
    findByName(name: string, version: string): ToolLookupResult {
      const found = ordered.find(
        (item) => item.name === name && item.version === version,
      );
      return found ? deepFreeze({ ok: true, value: found }) : unknown();
    },
    list: () => ordered,
  });
};
