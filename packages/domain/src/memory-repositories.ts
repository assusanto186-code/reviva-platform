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
import type {
  AuditRepository,
  KnowledgeRepository,
  TenantRepository,
} from "./repositories.js";
import { assertTenantAccess } from "./tenant-context.js";

function tenantKey(tenantId: TenantId, resourceId: string) {
  return `${tenantId}:${resourceId}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Test and local-development repository. It is not production persistence. */
export class InMemoryTenantRepository implements TenantRepository {
  private readonly tenants = new Map<string, Tenant>();
  private readonly organizations = new Map<string, Organization>();
  private readonly locations = new Map<string, Location>();
  private readonly memberships = new Map<string, Membership>();

  async saveTenant(context: TenantContext, tenant: Tenant) {
    assertTenantAccess(context, tenant.id);
    this.tenants.set(tenant.id, clone(tenant));
  }

  async getTenant(context: TenantContext, id: TenantId) {
    assertTenantAccess(context, id);
    const tenant = this.tenants.get(id);
    return tenant ? clone(tenant) : null;
  }

  async saveOrganization(
    context: TenantContext,
    organization: Organization,
  ) {
    assertTenantAccess(context, organization.tenantId);
    this.organizations.set(
      tenantKey(context.tenantId, organization.id),
      clone(organization),
    );
  }

  async getOrganization(context: TenantContext, id: OrganizationId) {
    const organization = this.organizations.get(
      tenantKey(context.tenantId, id),
    );
    return organization ? clone(organization) : null;
  }

  async saveLocation(context: TenantContext, location: Location) {
    assertTenantAccess(context, location.tenantId);
    this.locations.set(
      tenantKey(context.tenantId, location.id),
      clone(location),
    );
  }

  async getLocation(context: TenantContext, id: LocationId) {
    const location = this.locations.get(tenantKey(context.tenantId, id));
    return location ? clone(location) : null;
  }

  async listLocations(
    context: TenantContext,
    organizationId: OrganizationId,
  ) {
    return [...this.locations.values()]
      .filter(
        (location) =>
          location.tenantId === context.tenantId &&
          location.organizationId === organizationId,
      )
      .map(clone);
  }

  async saveMembership(context: TenantContext, membership: Membership) {
    assertTenantAccess(context, membership.tenantId);
    this.memberships.set(
      tenantKey(context.tenantId, membership.id),
      clone(membership),
    );
  }

  async getMembership(context: TenantContext, id: MembershipId) {
    const membership = this.memberships.get(tenantKey(context.tenantId, id));
    return membership ? clone(membership) : null;
  }
}

/** Test and local-development repository. It is not production persistence. */
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly sources = new Map<string, KnowledgeSource>();
  private readonly entries = new Map<string, KnowledgeEntry>();
  private readonly versions = new Map<string, KnowledgeVersion>();

  async saveSource(context: TenantContext, source: KnowledgeSource) {
    assertTenantAccess(context, source.tenantId);
    this.sources.set(tenantKey(context.tenantId, source.id), clone(source));
  }

  async getSource(context: TenantContext, id: KnowledgeSourceId) {
    const source = this.sources.get(tenantKey(context.tenantId, id));
    return source ? clone(source) : null;
  }

  async saveEntry(context: TenantContext, entry: KnowledgeEntry) {
    assertTenantAccess(context, entry.tenantId);
    this.entries.set(tenantKey(context.tenantId, entry.id), clone(entry));
  }

  async getEntry(context: TenantContext, id: KnowledgeEntryId) {
    const entry = this.entries.get(tenantKey(context.tenantId, id));
    return entry ? clone(entry) : null;
  }

  async saveVersion(context: TenantContext, version: KnowledgeVersion) {
    assertTenantAccess(context, version.tenantId);
    this.versions.set(tenantKey(context.tenantId, version.id), clone(version));
  }

  async saveVersions(
    context: TenantContext,
    versions: readonly KnowledgeVersion[],
  ) {
    for (const version of versions) {
      await this.saveVersion(context, version);
    }
  }

  async listVersions(context: TenantContext, entryId: KnowledgeEntryId) {
    return [...this.versions.values()]
      .filter(
        (version) =>
          version.tenantId === context.tenantId &&
          version.entryId === entryId,
      )
      .sort((left, right) => left.revision - right.revision)
      .map(clone);
  }
}

/** Test and local-development audit store. It is not durable. */
export class InMemoryAuditRepository implements AuditRepository {
  private readonly events: AuditEvent[] = [];

  async append(context: TenantContext, event: AuditEvent) {
    assertTenantAccess(context, event.tenantId);
    this.events.push(clone(event));
  }

  async list(context: TenantContext) {
    return this.events
      .filter((event) => event.tenantId === context.tenantId)
      .map(clone);
  }
}
