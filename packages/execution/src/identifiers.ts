declare const executionIdentifier: unique symbol;

type ExecutionIdentifier<Name extends string> = string & {
  readonly [executionIdentifier]: Name;
};

export type ExecutionId = ExecutionIdentifier<"ExecutionId">;
export type ProviderIdentifier = ExecutionIdentifier<"ProviderIdentifier">;
export type ModelIdentifier = ExecutionIdentifier<"ModelIdentifier">;
export type SchemaIdentifier = ExecutionIdentifier<"SchemaIdentifier">;
export type ProviderRequestIdentifier =
  ExecutionIdentifier<"ProviderRequestIdentifier">;

export class InvalidExecutionIdentifier extends Error {
  readonly code = "InvalidExecutionIdentifier" as const;

  constructor(readonly identifierName: string) {
    super(`${identifierName} is invalid.`);
    this.name = "InvalidExecutionIdentifier";
  }
}

const boundedIdentifier = /^[a-z][a-z0-9._:-]{0,127}$/u;

const identifier = <Name extends string>(
  value: string,
  name: Name,
): ExecutionIdentifier<Name> => {
  if (
    value !== value.trim() ||
    !boundedIdentifier.test(value) ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new InvalidExecutionIdentifier(name);
  }
  return value as ExecutionIdentifier<Name>;
};

export const executionId = (value: string): ExecutionId =>
  identifier(value, "ExecutionId");
export const providerIdentifier = (value: string): ProviderIdentifier =>
  identifier(value, "ProviderIdentifier");
export const modelIdentifier = (value: string): ModelIdentifier =>
  identifier(value, "ModelIdentifier");
export const schemaIdentifier = (value: string): SchemaIdentifier =>
  identifier(value, "SchemaIdentifier");
export const providerRequestIdentifier = (
  value: string,
): ProviderRequestIdentifier =>
  identifier(value, "ProviderRequestIdentifier");
