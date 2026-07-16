import type {
  AuditEventId,
  KnowledgeEntryId,
  KnowledgeSourceId,
  KnowledgeVersionId,
  LocationId,
  MembershipId,
  OrganizationId,
  RequestId,
  TenantId,
  UserId,
} from "./identifiers.js";

export type IsoTimestamp = string;
export type TenantStatus = "active" | "suspended";
export type LocationStatus = "active" | "inactive";
export type UserStatus = "active" | "disabled";
export type MembershipStatus = "active" | "invited" | "disabled";
export type TenantRole = "owner" | "admin" | "manager" | "agent" | "viewer";

export type Tenant = {
  id: TenantId;
  slug: string;
  name: string;
  status: TenantStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type Organization = {
  id: OrganizationId;
  tenantId: TenantId;
  name: string;
  legalName: string | null;
  timezone: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type Location = {
  id: LocationId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  name: string;
  timezone: string;
  status: LocationStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type User = {
  id: UserId;
  authSubject: string;
  email: string;
  displayName: string;
  status: UserStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type Membership = {
  id: MembershipId;
  tenantId: TenantId;
  userId: UserId;
  role: TenantRole;
  status: MembershipStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type TenantContext = {
  tenantId: TenantId;
  actorId: UserId;
  actorRole: TenantRole;
  requestId: RequestId;
};

export type KnowledgeSourceKind =
  | "website"
  | "document"
  | "operator"
  | "integration";
export type KnowledgeSourceStatus = "active" | "archived";
export type KnowledgeEntryStatus = "draft" | "published" | "archived";
export type KnowledgeVersionStatus = "draft" | "published" | "superseded";

export type KnowledgeSource = {
  id: KnowledgeSourceId;
  tenantId: TenantId;
  locationId: LocationId | null;
  kind: KnowledgeSourceKind;
  name: string;
  uri: string | null;
  ownerUserId: UserId;
  status: KnowledgeSourceStatus;
  lastVerifiedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type KnowledgeEntry = {
  id: KnowledgeEntryId;
  tenantId: TenantId;
  sourceId: KnowledgeSourceId;
  locationId: LocationId | null;
  key: string;
  title: string;
  status: KnowledgeEntryStatus;
  activeVersionId: KnowledgeVersionId | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type KnowledgeVersion = {
  id: KnowledgeVersionId;
  tenantId: TenantId;
  entryId: KnowledgeEntryId;
  sourceId: KnowledgeSourceId;
  revision: number;
  content: string;
  sourceLocator: string | null;
  status: KnowledgeVersionStatus;
  createdBy: UserId;
  createdAt: IsoTimestamp;
  publishedAt: IsoTimestamp | null;
  verifiedAt: IsoTimestamp | null;
};

export type AuditEvent = {
  id: AuditEventId;
  tenantId: TenantId;
  actorId: UserId;
  requestId: RequestId;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: IsoTimestamp;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
};
