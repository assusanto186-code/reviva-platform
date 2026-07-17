export class PostgresConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "PostgresConfigurationError"; }
}
export class InvalidTenantContextError extends Error {
  constructor(message = "Tenant context is missing, malformed, or unauthorized.") {
    super(message); this.name = "InvalidTenantContextError";
  }
}
export class TransactionSessionClosedError extends Error {
  constructor() { super("Repository session cannot be reused after its transaction ends."); this.name = "TransactionSessionClosedError"; }
}
export class OptimisticLockError extends Error {
  constructor(type: string, id: string) { super(`${type} ${id} was changed by another transaction.`); this.name = "OptimisticLockError"; }
}
export class PersistenceConflictError extends Error {
  constructor(message: string) { super(message); this.name = "PersistenceConflictError"; }
}
