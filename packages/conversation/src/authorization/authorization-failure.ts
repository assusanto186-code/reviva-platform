export class InvalidAuthorizationContext extends Error {
  readonly code = "InvalidAuthorizationContext" as const;

  constructor(readonly reason: string) {
    super("Authorization context is invalid.");
    this.name = "InvalidAuthorizationContext";
  }
}

export class InvalidToolDescriptor extends Error {
  readonly code = "InvalidToolDescriptor" as const;

  constructor(readonly reason: string) {
    super("Tool descriptor is invalid.");
    this.name = "InvalidToolDescriptor";
  }
}

export class DuplicateToolIdentifier extends Error {
  readonly code = "DuplicateToolIdentifier" as const;

  constructor() {
    super("Tool identifiers must be unique.");
    this.name = "DuplicateToolIdentifier";
  }
}

export class DuplicateToolName extends Error {
  readonly code = "DuplicateToolName" as const;

  constructor() {
    super("Tool names and versions must be unique.");
    this.name = "DuplicateToolName";
  }
}

export type UnknownTool = Readonly<{
  code: "UnknownTool";
}>;

export type ToolCapabilityMismatch = Readonly<{
  code: "ToolCapabilityMismatch";
}>;
