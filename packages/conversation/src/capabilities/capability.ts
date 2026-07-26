import { deepFreeze } from "../internal/immutable.js";

const capabilityValues = [
  "conversation.start",
  "conversation.read",
  "conversation.respond",
  "conversation.message.record_inbound",
  "conversation.message.record_outbound",
  "conversation.await_user",
  "conversation.assign",
  "conversation.resolve",
  "conversation.close",
  "conversation.reopen",
  "conversation.fail",
  "conversation.recover",
  "booking.intent.record",
  "booking.progress.update",
  "booking.confirmation.request",
  "booking.confirmation.record",
  "booking.availability.read",
  "booking.create",
  "booking.modify",
  "booking.cancel.request",
  "tool.propose",
  "tool.result.record",
  "handoff.request",
  "handoff.accept",
  "handoff.resolve",
  "automation.resume",
  "reactivation.start",
  "reactivation.stop",
  "reactivation.response.record",
  "knowledge.read",
] as const;

export type Capability = (typeof capabilityValues)[number];
export const capabilities: readonly Capability[] = Object.freeze([
  ...capabilityValues,
]);

export type CapabilitySet = Readonly<{
  values: readonly Capability[];
}>;

export class InvalidCapability extends Error {
  readonly code = "InvalidCapability" as const;

  constructor() {
    super("Capability must be one of the canonical Reviva capabilities.");
    this.name = "InvalidCapability";
  }
}

export const isCapability = (value: string): value is Capability =>
  capabilities.some((candidate) => candidate === value);

export const capability = (value: string): Capability => {
  if (!isCapability(value)) throw new InvalidCapability();
  return value;
};

export const createCapabilitySet = (
  values: readonly (Capability | string)[],
): CapabilitySet => {
  const validated = values.map(capability);
  return deepFreeze({
    values: [...new Set(validated)].sort((left, right) => left.localeCompare(right)),
  });
};

export const emptyCapabilitySet = (): CapabilitySet => createCapabilitySet([]);

export const capabilitySetHas = (
  set: CapabilitySet,
  requested: Capability,
): boolean => set.values.includes(requested);

export const intersectCapabilitySets = (
  ...sets: readonly CapabilitySet[]
): CapabilitySet => {
  if (sets.length === 0) return emptyCapabilitySet();
  const [first, ...rest] = sets;
  if (!first) return emptyCapabilitySet();

  return createCapabilitySet(
    first.values.filter((item) => rest.every((set) => capabilitySetHas(set, item))),
  );
};
