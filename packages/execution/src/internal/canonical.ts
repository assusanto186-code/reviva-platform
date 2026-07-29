import type { CanonicalValue } from "@reviva/conversation";

export const cloneCanonicalValue = (value: CanonicalValue): CanonicalValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneCanonicalValue(item));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      cloneCanonicalValue(item),
    ]),
  );
};
