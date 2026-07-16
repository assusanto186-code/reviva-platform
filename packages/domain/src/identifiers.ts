declare const opaqueIdentifier: unique symbol;

type OpaqueIdentifier<Name extends string> = string & {
  readonly [opaqueIdentifier]: Name;
};

export type TenantId = OpaqueIdentifier<"TenantId">;
export type OrganizationId = OpaqueIdentifier<"OrganizationId">;
export type LocationId = OpaqueIdentifier<"LocationId">;
export type UserId = OpaqueIdentifier<"UserId">;
export type MembershipId = OpaqueIdentifier<"MembershipId">;
export type KnowledgeSourceId = OpaqueIdentifier<"KnowledgeSourceId">;
export type KnowledgeEntryId = OpaqueIdentifier<"KnowledgeEntryId">;
export type KnowledgeVersionId = OpaqueIdentifier<"KnowledgeVersionId">;
export type AuditEventId = OpaqueIdentifier<"AuditEventId">;
export type RequestId = OpaqueIdentifier<"RequestId">;

function createIdentifier<Name extends string>(value: string, name: Name) {
  const normalized = value.trim();

  if (!normalized || normalized.length > 128) {
    throw new Error(`${name} must contain 1 to 128 characters.`);
  }

  return normalized as OpaqueIdentifier<Name>;
}

export const tenantId = (value: string) => createIdentifier(value, "TenantId");
export const organizationId = (value: string) =>
  createIdentifier(value, "OrganizationId");
export const locationId = (value: string) =>
  createIdentifier(value, "LocationId");
export const userId = (value: string) => createIdentifier(value, "UserId");
export const membershipId = (value: string) =>
  createIdentifier(value, "MembershipId");
export const knowledgeSourceId = (value: string) =>
  createIdentifier(value, "KnowledgeSourceId");
export const knowledgeEntryId = (value: string) =>
  createIdentifier(value, "KnowledgeEntryId");
export const knowledgeVersionId = (value: string) =>
  createIdentifier(value, "KnowledgeVersionId");
export const auditEventId = (value: string) =>
  createIdentifier(value, "AuditEventId");
export const requestId = (value: string) =>
  createIdentifier(value, "RequestId");
