import {
  canonicalRequestFingerprint,
  type CanonicalValue,
  type RequestFingerprint,
} from "@reviva/conversation";

import { deepFreeze } from "./immutable.js";

const forbiddenKey = /^(?:__proto__|prototype|constructor)$/u;
const sensitiveKey =
  /(?:password|passcode|secret|token|authorization|cookie|connection.?string|credential|private.?key)/iu;
const sensitiveValue =
  /(?:postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu;

export class InvalidRuntimeCanonicalValue extends Error {
  readonly code = "InvalidRuntimeCanonicalValue" as const;

  constructor(readonly reason: string) {
    super(`Runtime canonical value is invalid: ${reason}.`);
    this.name = "InvalidRuntimeCanonicalValue";
  }
}

const clone = (
  value: unknown,
  path: string,
  depth: number,
  seen: Set<object>,
  rejectSensitive: boolean,
): CanonicalValue => {
  if (depth > 12) throw new InvalidRuntimeCanonicalValue(`${path}:too_deep`);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > 4096) {
      throw new InvalidRuntimeCanonicalValue(`${path}:string_too_long`);
    }
    if (rejectSensitive && sensitiveValue.test(value)) {
      throw new InvalidRuntimeCanonicalValue(`${path}:sensitive_value`);
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InvalidRuntimeCanonicalValue(`${path}:non_finite_number`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new InvalidRuntimeCanonicalValue(`${path}:non_canonical_value`);
  }
  if (seen.has(value)) {
    throw new InvalidRuntimeCanonicalValue(`${path}:cyclic_value`);
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > 128) {
        throw new InvalidRuntimeCanonicalValue(`${path}:array_too_large`);
      }
      return value.map((item, index) =>
        clone(item, `${path}[${index}]`, depth + 1, seen, rejectSensitive),
      );
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new InvalidRuntimeCanonicalValue(`${path}:non_plain_object`);
    }
    const entries = Object.entries(value);
    if (entries.length > 128) {
      throw new InvalidRuntimeCanonicalValue(`${path}:object_too_large`);
    }
    const result: Record<string, CanonicalValue> = Object.create(null);
    for (const [key, nested] of entries.sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (forbiddenKey.test(key)) {
        throw new InvalidRuntimeCanonicalValue(
          `${path}.${key}:prototype_pollution_key`,
        );
      }
      if (rejectSensitive && sensitiveKey.test(key)) {
        throw new InvalidRuntimeCanonicalValue(`${path}.${key}:sensitive_key`);
      }
      result[key] = clone(
        nested,
        `${path}.${key}`,
        depth + 1,
        seen,
        rejectSensitive,
      );
    }
    return result;
  } finally {
    seen.delete(value);
  }
};

export const cloneRuntimeCanonicalValue = (
  value: unknown,
): CanonicalValue =>
  deepFreeze(clone(value, "$", 0, new Set(), true));

export const cloneSafeStructure = (value: unknown): CanonicalValue =>
  deepFreeze(clone(value, "$", 0, new Set(), false));

export const runtimeCanonicalFingerprint = (
  value: unknown,
): RequestFingerprint =>
  canonicalRequestFingerprint(cloneRuntimeCanonicalValue(value));
