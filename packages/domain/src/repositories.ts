import type {
  AuditEvent,
  KnowledgeEntry,
  KnowledgeSource,
  KnowledgeVersion,
  Location,
  Membership,
  Organization,
  Tenant,
  TenantContext,
} from "./models.js";
import type {
  KnowledgeEntryId,
  KnowledgeSourceId,
  LocationId,
  MembershipId,
  OrganizationId,
  TenantId,
} from "./identifiers.js";

export interface TenantRepository {
  saveTenant(context: TenantContext, tenant: Tenant): Promise<void>;
  getTenant(context: TenantContext, id: TenantId): Promise<Tenant | null>;
  saveOrganization(
    context: TenantContext,
    organization: Organization,
  ): Promise<void>;
  getOrganization(
    context: TenantContext,
    id: OrganizationId,
  ): Promise<Organization | null>;
  saveLocation(context: TenantContext, location: Location): Promise<void>;
  getLocation(
    context: TenantContext,
    id: LocationId,
  ): Promise<Location | null>;
  listLocations(
    context: TenantContext,
    organizationId: OrganizationId,
  ): Promise<Location[]>;
  saveMembership(
    context: TenantContext,
    membership: Membership,
  ): Promise<void>;
  getMembership(
    context: TenantContext,
    id: MembershipId,
  ): Promise<Membership | null>;
}

export interface KnowledgeRepository {
  saveSource(context: TenantContext, source: KnowledgeSource): Promise<void>;
  getSource(
    context: TenantContext,
    id: KnowledgeSourceId,
  ): Promise<KnowledgeSource | null>;
  saveEntry(context: TenantContext, entry: KnowledgeEntry): Promise<void>;
  getEntry(
    context: TenantContext,
    id: KnowledgeEntryId,
  ): Promise<KnowledgeEntry | null>;
  saveVersion(context: TenantContext, version: KnowledgeVersion): Promise<void>;
  saveVersions(
    context: TenantContext,
    versions: readonly KnowledgeVersion[],
  ): Promise<void>;
  listVersions(
    context: TenantContext,
    entryId: KnowledgeEntryId,
  ): Promise<KnowledgeVersion[]>;
}

export interface AuditRepository {
  append(context: TenantContext, event: AuditEvent): Promise<void>;
  list(context: TenantContext): Promise<AuditEvent[]>;
}
