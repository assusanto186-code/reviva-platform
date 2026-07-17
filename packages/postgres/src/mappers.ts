import {
  auditEventId, knowledgeEntryId, knowledgeSourceId, knowledgeVersionId,
  locationId, membershipId, organizationId, requestId, tenantId, userId,
  type AuditEvent, type KnowledgeEntry, type KnowledgeSource,
  type KnowledgeVersion, type Location, type Membership, type Organization, type Tenant,
} from "@reviva/domain";
type Timestamp = Date | string;
const iso = (value: Timestamp) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const optionalIso = (value: Timestamp | null) => value === null ? null : iso(value);

export type TenantRow = { id:string; slug:string; name:string; status:Tenant["status"]; created_at:Timestamp; updated_at:Timestamp };
export type OrganizationRow = { id:string; tenant_id:string; name:string; legal_name:string|null; timezone:string; created_at:Timestamp; updated_at:Timestamp };
export type LocationRow = { id:string; tenant_id:string; organization_id:string; name:string; timezone:string; status:Location["status"]; created_at:Timestamp; updated_at:Timestamp };
export type MembershipRow = { id:string; tenant_id:string; user_id:string; role:Membership["role"]; status:Membership["status"]; created_at:Timestamp; updated_at:Timestamp };
export type KnowledgeSourceRow = { id:string; tenant_id:string; location_id:string|null; kind:KnowledgeSource["kind"]; name:string; uri:string|null; owner_user_id:string; status:KnowledgeSource["status"]; last_verified_at:Timestamp|null; created_at:Timestamp; updated_at:Timestamp };
export type KnowledgeEntryRow = { id:string; tenant_id:string; source_id:string; location_id:string|null; key:string; title:string; status:KnowledgeEntry["status"]; active_version_id:string|null; created_at:Timestamp; updated_at:Timestamp };
export type KnowledgeVersionRow = { id:string; tenant_id:string; entry_id:string; source_id:string; revision:number; content:string; source_locator:string|null; status:KnowledgeVersion["status"]; created_by:string; created_at:Timestamp; published_at:Timestamp|null; verified_at:Timestamp|null };
export type AuditEventRow = { id:string; tenant_id:string; actor_id:string; request_id:string; action:string; resource_type:string; resource_id:string; occurred_at:Timestamp; metadata:AuditEvent["metadata"] };

export const mapTenant = (r:TenantRow):Tenant => ({ id:tenantId(r.id), slug:r.slug, name:r.name, status:r.status, createdAt:iso(r.created_at), updatedAt:iso(r.updated_at) });
export const mapOrganization = (r:OrganizationRow):Organization => ({ id:organizationId(r.id), tenantId:tenantId(r.tenant_id), name:r.name, legalName:r.legal_name, timezone:r.timezone, createdAt:iso(r.created_at), updatedAt:iso(r.updated_at) });
export const mapLocation = (r:LocationRow):Location => ({ id:locationId(r.id), tenantId:tenantId(r.tenant_id), organizationId:organizationId(r.organization_id), name:r.name, timezone:r.timezone, status:r.status, createdAt:iso(r.created_at), updatedAt:iso(r.updated_at) });
export const mapMembership = (r:MembershipRow):Membership => ({ id:membershipId(r.id), tenantId:tenantId(r.tenant_id), userId:userId(r.user_id), role:r.role, status:r.status, createdAt:iso(r.created_at), updatedAt:iso(r.updated_at) });
export const mapKnowledgeSource = (r:KnowledgeSourceRow):KnowledgeSource => ({ id:knowledgeSourceId(r.id), tenantId:tenantId(r.tenant_id), locationId:r.location_id?locationId(r.location_id):null, kind:r.kind, name:r.name, uri:r.uri, ownerUserId:userId(r.owner_user_id), status:r.status, lastVerifiedAt:optionalIso(r.last_verified_at), createdAt:iso(r.created_at), updatedAt:iso(r.updated_at) });
export const mapKnowledgeEntry = (r:KnowledgeEntryRow):KnowledgeEntry => ({ id:knowledgeEntryId(r.id), tenantId:tenantId(r.tenant_id), sourceId:knowledgeSourceId(r.source_id), locationId:r.location_id?locationId(r.location_id):null, key:r.key, title:r.title, status:r.status, activeVersionId:r.active_version_id?knowledgeVersionId(r.active_version_id):null, createdAt:iso(r.created_at), updatedAt:iso(r.updated_at) });
export const mapKnowledgeVersion = (r:KnowledgeVersionRow):KnowledgeVersion => ({ id:knowledgeVersionId(r.id), tenantId:tenantId(r.tenant_id), entryId:knowledgeEntryId(r.entry_id), sourceId:knowledgeSourceId(r.source_id), revision:r.revision, content:r.content, sourceLocator:r.source_locator, status:r.status, createdBy:userId(r.created_by), createdAt:iso(r.created_at), publishedAt:optionalIso(r.published_at), verifiedAt:optionalIso(r.verified_at) });
export const mapAuditEvent = (r:AuditEventRow):AuditEvent => ({ id:auditEventId(r.id), tenantId:tenantId(r.tenant_id), actorId:userId(r.actor_id), requestId:requestId(r.request_id), action:r.action, resourceType:r.resource_type, resourceId:r.resource_id, occurredAt:iso(r.occurred_at), metadata:r.metadata });
