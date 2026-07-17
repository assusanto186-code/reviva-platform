import {
  assertTenantAccess, type AuditEvent, type AuditRepository, type KnowledgeEntry,
  type KnowledgeEntryId, type KnowledgeRepository, type KnowledgeSource,
  type KnowledgeSourceId, type KnowledgeVersion, type Location, type LocationId,
  type Membership, type MembershipId, type Organization, type OrganizationId,
  type Tenant, type TenantContext, type TenantId, type TenantRepository,
} from "@reviva/domain";
import type { TransactionSql } from "postgres";
import { OptimisticLockError, PersistenceConflictError, TransactionSessionClosedError } from "./errors.js";
import {
  mapAuditEvent, mapKnowledgeEntry, mapKnowledgeSource, mapKnowledgeVersion,
  mapLocation, mapMembership, mapOrganization, mapTenant,
  type AuditEventRow, type KnowledgeEntryRow, type KnowledgeSourceRow,
  type KnowledgeVersionRow, type LocationRow, type MembershipRow,
  type OrganizationRow, type TenantRow,
} from "./mappers.js";

export type SessionState = { active:boolean };
function sameMetadata(left:AuditEvent["metadata"],right:AuditEvent["metadata"]){
  const leftKeys=Object.keys(left).sort(),rightKeys=Object.keys(right).sort();
  return leftKeys.length===rightKeys.length && leftKeys.every((key,index)=>key===rightKeys[index]&&left[key]===right[key]);
}
abstract class BoundRepository {
  constructor(protected readonly sql:TransactionSql, private readonly bound:TenantContext, private readonly state:SessionState) {}
  protected assertContext(context:TenantContext) {
    if (!this.state.active) throw new TransactionSessionClosedError();
    if (context.tenantId!==this.bound.tenantId || context.actorId!==this.bound.actorId ||
      context.actorRole!==this.bound.actorRole || context.requestId!==this.bound.requestId)
      throw new PersistenceConflictError("Repository context differs from transaction context.");
  }
}

export class PostgresTenantRepository extends BoundRepository implements TenantRepository {
  async saveTenant(c:TenantContext,v:Tenant) { this.assertContext(c); assertTenantAccess(c,v.id);
    await this.sql`insert into public.tenants(id,slug,name,status,created_at,updated_at)
      values(${v.id},${v.slug},${v.name},${v.status},${v.createdAt},${v.updatedAt})
      on conflict(id) do update set slug=excluded.slug,name=excluded.name,status=excluded.status,
      updated_at=excluded.updated_at,lock_version=public.tenants.lock_version+1`; }
  async getTenant(c:TenantContext,id:TenantId) { this.assertContext(c); assertTenantAccess(c,id);
    const r=await this.sql<TenantRow[]>`select id,slug,name,status,created_at,updated_at from public.tenants where id=${id}`;
    return r[0]?mapTenant(r[0]):null; }
  async saveOrganization(c:TenantContext,v:Organization) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    await this.sql`insert into public.organizations(id,tenant_id,name,legal_name,timezone,created_at,updated_at)
      values(${v.id},${v.tenantId},${v.name},${v.legalName},${v.timezone},${v.createdAt},${v.updatedAt})
      on conflict(id) do update set name=excluded.name,legal_name=excluded.legal_name,
      timezone=excluded.timezone,updated_at=excluded.updated_at,lock_version=public.organizations.lock_version+1`; }
  async getOrganization(c:TenantContext,id:OrganizationId) { this.assertContext(c);
    const r=await this.sql<OrganizationRow[]>`select id,tenant_id,name,legal_name,timezone,created_at,updated_at from public.organizations where id=${id}`;
    return r[0]?mapOrganization(r[0]):null; }
  async saveLocation(c:TenantContext,v:Location) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    await this.sql`insert into public.locations(id,tenant_id,organization_id,name,timezone,status,created_at,updated_at)
      values(${v.id},${v.tenantId},${v.organizationId},${v.name},${v.timezone},${v.status},${v.createdAt},${v.updatedAt})
      on conflict(id) do update set organization_id=excluded.organization_id,name=excluded.name,
      timezone=excluded.timezone,status=excluded.status,updated_at=excluded.updated_at,
      lock_version=public.locations.lock_version+1`; }
  async getLocation(c:TenantContext,id:LocationId) { this.assertContext(c);
    const r=await this.sql<LocationRow[]>`select id,tenant_id,organization_id,name,timezone,status,created_at,updated_at from public.locations where id=${id}`;
    return r[0]?mapLocation(r[0]):null; }
  async listLocations(c:TenantContext,organizationId:OrganizationId) { this.assertContext(c);
    const r=await this.sql<LocationRow[]>`select id,tenant_id,organization_id,name,timezone,status,created_at,updated_at from public.locations where organization_id=${organizationId} order by created_at,id`;
    return r.map(mapLocation); }
  async saveMembership(c:TenantContext,v:Membership) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    await this.sql`insert into public.memberships(id,tenant_id,user_id,role,status,created_at,updated_at)
      values(${v.id},${v.tenantId},${v.userId},${v.role},${v.status},${v.createdAt},${v.updatedAt})
      on conflict(id) do update set user_id=excluded.user_id,role=excluded.role,status=excluded.status,
      updated_at=excluded.updated_at,lock_version=public.memberships.lock_version+1`; }
  async getMembership(c:TenantContext,id:MembershipId) { this.assertContext(c);
    const r=await this.sql<MembershipRow[]>`select id,tenant_id,user_id,role,status,created_at,updated_at from public.memberships where id=${id}`;
    return r[0]?mapMembership(r[0]):null; }
}

export class PostgresKnowledgeRepository extends BoundRepository implements KnowledgeRepository {
  async saveSource(c:TenantContext,v:KnowledgeSource) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    await this.sql`insert into public.knowledge_sources(id,tenant_id,location_id,kind,name,uri,owner_user_id,status,last_verified_at,created_at,updated_at)
      values(${v.id},${v.tenantId},${v.locationId},${v.kind},${v.name},${v.uri},${v.ownerUserId},${v.status},${v.lastVerifiedAt},${v.createdAt},${v.updatedAt})
      on conflict(id) do update set location_id=excluded.location_id,kind=excluded.kind,name=excluded.name,
      uri=excluded.uri,owner_user_id=excluded.owner_user_id,status=excluded.status,
      last_verified_at=excluded.last_verified_at,updated_at=excluded.updated_at,
      lock_version=public.knowledge_sources.lock_version+1`; }
  async getSource(c:TenantContext,id:KnowledgeSourceId) { this.assertContext(c);
    const r=await this.sql<KnowledgeSourceRow[]>`select id,tenant_id,location_id,kind,name,uri,owner_user_id,status,last_verified_at,created_at,updated_at from public.knowledge_sources where id=${id}`;
    return r[0]?mapKnowledgeSource(r[0]):null; }
  async saveEntry(c:TenantContext,v:KnowledgeEntry) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    const found=await this.sql`select lock_version from public.knowledge_entries where id=${v.id} for update`;
    if (!found[0]) { await this.sql`insert into public.knowledge_entries(id,tenant_id,source_id,location_id,key,title,status,active_version_id,created_at,updated_at)
      values(${v.id},${v.tenantId},${v.sourceId},${v.locationId},${v.key},${v.title},${v.status},${v.activeVersionId},${v.createdAt},${v.updatedAt})`; return; }
    await this.sql`update public.knowledge_entries set source_id=${v.sourceId},location_id=${v.locationId},key=${v.key},title=${v.title},status=${v.status},active_version_id=${v.activeVersionId},updated_at=${v.updatedAt},lock_version=lock_version+1 where id=${v.id}`; }
  async saveEntryWithExpectedVersion(c:TenantContext,v:KnowledgeEntry,expected:number) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    if (!Number.isSafeInteger(expected)||expected<1) throw new PersistenceConflictError("Expected version must be positive.");
    const r=await this.sql<{lock_version:number}[]>`update public.knowledge_entries set source_id=${v.sourceId},location_id=${v.locationId},key=${v.key},title=${v.title},status=${v.status},active_version_id=${v.activeVersionId},updated_at=${v.updatedAt},lock_version=lock_version+1 where id=${v.id} and tenant_id=${v.tenantId} and lock_version=${expected} returning lock_version::integer as lock_version`;
    if (!r[0]) throw new OptimisticLockError("knowledge-entry",v.id); return r[0].lock_version; }
  async getEntry(c:TenantContext,id:KnowledgeEntryId) { this.assertContext(c);
    const r=await this.sql<KnowledgeEntryRow[]>`select id,tenant_id,source_id,location_id,key,title,status,active_version_id,created_at,updated_at from public.knowledge_entries where id=${id}`;
    return r[0]?mapKnowledgeEntry(r[0]):null; }
  async saveVersion(c:TenantContext,v:KnowledgeVersion) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    await this.sql`insert into public.knowledge_versions(id,tenant_id,entry_id,source_id,revision,content,source_locator,status,created_by,created_at,published_at,verified_at)
      values(${v.id},${v.tenantId},${v.entryId},${v.sourceId},${v.revision},${v.content},${v.sourceLocator},${v.status},${v.createdBy},${v.createdAt},${v.publishedAt},${v.verifiedAt})
      on conflict(id) do update set status=excluded.status,published_at=excluded.published_at`; }
  async saveVersions(c:TenantContext,values:readonly KnowledgeVersion[]) { this.assertContext(c); for(const v of values) await this.saveVersion(c,v); }
  async listVersions(c:TenantContext,entryId:KnowledgeEntryId) { this.assertContext(c);
    const r=await this.sql<KnowledgeVersionRow[]>`select id,tenant_id,entry_id,source_id,revision,content,source_locator,status,created_by,created_at,published_at,verified_at from public.knowledge_versions where entry_id=${entryId} order by revision`;
    return r.map(mapKnowledgeVersion); }
}

export class PostgresAuditRepository extends BoundRepository implements AuditRepository {
  async append(c:TenantContext,v:AuditEvent) { this.assertContext(c); assertTenantAccess(c,v.tenantId);
    const inserted=await this.sql`insert into public.audit_events(id,tenant_id,actor_id,request_id,action,resource_type,resource_id,occurred_at,metadata)
      values(${v.id},${v.tenantId},${v.actorId},${v.requestId},${v.action},${v.resourceType},${v.resourceId},${v.occurredAt},${this.sql.json(v.metadata)}) on conflict(id) do nothing returning id`;
    if (inserted[0]) return;
    const r=await this.sql<AuditEventRow[]>`select id,tenant_id,actor_id,request_id,action,resource_type,resource_id,occurred_at,metadata from public.audit_events where id=${v.id}`;
    const e=r[0]?mapAuditEvent(r[0]):null;
    if (!e||e.tenantId!==v.tenantId||e.actorId!==v.actorId||e.requestId!==v.requestId||
      e.action!==v.action||e.resourceType!==v.resourceType||e.resourceId!==v.resourceId||
      e.occurredAt!==v.occurredAt||!sameMetadata(e.metadata,v.metadata))
      throw new PersistenceConflictError("Audit ID conflicts with different evidence."); }
  async list(c:TenantContext) { this.assertContext(c);
    const r=await this.sql<AuditEventRow[]>`select id,tenant_id,actor_id,request_id,action,resource_type,resource_id,occurred_at,metadata from public.audit_events order by occurred_at,id`;
    return r.map(mapAuditEvent); }
}
