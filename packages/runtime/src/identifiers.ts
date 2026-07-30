declare const runtimeIdentifierBrand: unique symbol;

type RuntimeIdentifier<Name extends string> = string & {
  readonly [runtimeIdentifierBrand]: Name;
};

export type RuntimeExecutionId = RuntimeIdentifier<"RuntimeExecutionId">;
export type RuntimeHandlerIdentifier =
  RuntimeIdentifier<"RuntimeHandlerIdentifier">;
export type HandoffTransitionId =
  RuntimeIdentifier<"HandoffTransitionId">;

export class InvalidRuntimeIdentifier extends Error {
  readonly code = "InvalidRuntimeIdentifier" as const;

  constructor(readonly identifierType: string) {
    super(`${identifierType} is invalid.`);
    this.name = "InvalidRuntimeIdentifier";
  }
}

const safeIdentifier = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/u;

const identifier = <Name extends string>(
  value: string,
  name: Name,
): RuntimeIdentifier<Name> => {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    !safeIdentifier.test(value)
  ) {
    throw new InvalidRuntimeIdentifier(name);
  }
  return value as RuntimeIdentifier<Name>;
};

export const runtimeExecutionId = (value: string): RuntimeExecutionId =>
  identifier(value, "RuntimeExecutionId");

export const runtimeHandlerIdentifier = (
  value: string,
): RuntimeHandlerIdentifier =>
  identifier(value, "RuntimeHandlerIdentifier");

export const handoffTransitionId = (value: string): HandoffTransitionId =>
  identifier(value, "HandoffTransitionId");
