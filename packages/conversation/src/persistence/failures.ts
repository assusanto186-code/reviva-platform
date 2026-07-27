export class InvalidPersistenceValue extends Error {
  readonly code = "InvalidPersistenceValue" as const;

  constructor(
    readonly valueName: string,
    readonly reason: string,
  ) {
    super(`${valueName} is invalid.`);
    this.name = "InvalidPersistenceValue";
  }
}

export class PersistenceConcurrencyConflict extends Error {
  readonly code = "PersistenceConcurrencyConflict" as const;
  readonly retryable = true;

  constructor(
    readonly resource: string,
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super("The persisted resource changed before this operation completed.");
    this.name = "PersistenceConcurrencyConflict";
  }
}

export class ConversationStreamNotFound extends Error {
  readonly code = "ConversationStreamNotFound" as const;

  constructor() {
    super("The conversation event stream does not exist.");
    this.name = "ConversationStreamNotFound";
  }
}

export class TenantScopeMismatch extends Error {
  readonly code = "TenantScopeMismatch" as const;

  constructor() {
    super("The persistence operation does not match the transaction tenant.");
    this.name = "TenantScopeMismatch";
  }
}

export class IdempotencyPayloadMismatch extends Error {
  readonly code = "IdempotencyPayloadMismatch" as const;

  constructor() {
    super("The idempotency key was already used with a different request fingerprint.");
    this.name = "IdempotencyPayloadMismatch";
  }
}

export class InvalidIdempotencyTransition extends Error {
  readonly code = "InvalidIdempotencyTransition" as const;

  constructor(readonly reason: string) {
    super("The idempotency record transition is invalid.");
    this.name = "InvalidIdempotencyTransition";
  }
}

export class TransactionClosed extends Error {
  readonly code = "TransactionClosed" as const;

  constructor(readonly transactionState: "committed" | "rolled_back") {
    super(`The transaction is already ${transactionState}.`);
    this.name = "TransactionClosed";
  }
}

export class HiddenNestedTransaction extends Error {
  readonly code = "HiddenNestedTransaction" as const;

  constructor() {
    super("Nested coordinated transactions are not supported.");
    this.name = "HiddenNestedTransaction";
  }
}

export class ForeignTransactionContext extends Error {
  readonly code = "ForeignTransactionContext" as const;

  constructor() {
    super("The transaction context was not created by this persistence store.");
    this.name = "ForeignTransactionContext";
  }
}

export class InvalidOutboxTransition extends Error {
  readonly code = "InvalidOutboxTransition" as const;

  constructor(
    readonly currentState: string,
    readonly requestedState: string,
  ) {
    super("The outbox state transition is invalid.");
    this.name = "InvalidOutboxTransition";
  }
}

export class SnapshotIncompatible extends Error {
  readonly code = "SnapshotIncompatible" as const;

  constructor(readonly reason: string) {
    super("The conversation snapshot is incompatible.");
    this.name = "SnapshotIncompatible";
  }
}

export class PersistenceMappingFailure extends Error {
  readonly code = "PersistenceMappingFailure" as const;

  constructor(readonly reason: string) {
    super("The persistence DTO is invalid or unsupported.");
    this.name = "PersistenceMappingFailure";
  }
}

export class DuplicatePersistenceIdentifier extends Error {
  readonly code = "DuplicatePersistenceIdentifier" as const;

  constructor(readonly resource: string) {
    super(`The ${resource} identifier already exists.`);
    this.name = "DuplicatePersistenceIdentifier";
  }
}
