import type { TenantContext, TenantRole } from "./models.js";
import type { TenantId } from "./identifiers.js";

export class TenantAccessError extends Error {
  constructor() {
    super("The active tenant cannot access the requested resource.");
    this.name = "TenantAccessError";
  }
}

export class TenantPermissionError extends Error {
  constructor(requiredRoles: readonly TenantRole[]) {
    super(`This operation requires one of these roles: ${requiredRoles.join(", ")}.`);
    this.name = "TenantPermissionError";
  }
}

export function assertTenantAccess(
  context: TenantContext,
  resourceTenantId: TenantId,
) {
  if (context.tenantId !== resourceTenantId) {
    throw new TenantAccessError();
  }
}

export function assertTenantRole(
  context: TenantContext,
  allowedRoles: readonly TenantRole[],
) {
  if (!allowedRoles.includes(context.actorRole)) {
    throw new TenantPermissionError(allowedRoles);
  }
}
