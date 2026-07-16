import type {
  AuditEvent,
  IsoTimestamp,
  KnowledgeEntry,
  KnowledgeVersion,
  TenantContext,
} from "./models.js";
import type {
  AuditEventId,
  KnowledgeVersionId,
} from "./identifiers.js";
import { assertTenantAccess, assertTenantRole } from "./tenant-context.js";

const knowledgeEditors = ["owner", "admin", "manager", "agent"] as const;
const knowledgePublishers = ["owner", "admin", "manager"] as const;

export class KnowledgeLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeLifecycleError";
  }
}

function assertEntryVersions(
  context: TenantContext,
  entry: KnowledgeEntry,
  versions: readonly KnowledgeVersion[],
) {
  assertTenantAccess(context, entry.tenantId);

  for (const version of versions) {
    assertTenantAccess(context, version.tenantId);

    if (version.entryId !== entry.id) {
      throw new KnowledgeLifecycleError(
        "Every version must belong to the knowledge entry being changed.",
      );
    }
  }
}

function assertUniqueVersionId(
  versions: readonly KnowledgeVersion[],
  id: KnowledgeVersionId,
) {
  if (versions.some((version) => version.id === id)) {
    throw new KnowledgeLifecycleError("Knowledge version IDs must be unique.");
  }
}

export function createDraftVersion(
  context: TenantContext,
  entry: KnowledgeEntry,
  versions: readonly KnowledgeVersion[],
  input: {
    id: KnowledgeVersionId;
    content: string;
    sourceLocator: string | null;
    createdAt: IsoTimestamp;
    verifiedAt: IsoTimestamp | null;
  },
) {
  assertTenantRole(context, knowledgeEditors);
  assertEntryVersions(context, entry, versions);
  assertUniqueVersionId(versions, input.id);

  if (entry.status === "archived") {
    throw new KnowledgeLifecycleError(
      "Archived knowledge entries cannot receive new drafts.",
    );
  }

  const content = input.content.trim();

  if (!content || content.length > 20_000) {
    throw new KnowledgeLifecycleError(
      "Knowledge content must contain 1 to 20,000 characters.",
    );
  }

  const nextRevision =
    versions.reduce(
      (highest, version) => Math.max(highest, version.revision),
      0,
    ) + 1;

  const version: KnowledgeVersion = {
    id: input.id,
    tenantId: entry.tenantId,
    entryId: entry.id,
    sourceId: entry.sourceId,
    revision: nextRevision,
    content,
    sourceLocator: input.sourceLocator,
    status: "draft",
    createdBy: context.actorId,
    createdAt: input.createdAt,
    publishedAt: null,
    verifiedAt: input.verifiedAt,
  };

  return version;
}

export function publishKnowledgeVersion(
  context: TenantContext,
  entry: KnowledgeEntry,
  versions: readonly KnowledgeVersion[],
  versionId: KnowledgeVersionId,
  publishedAt: IsoTimestamp,
) {
  assertTenantRole(context, knowledgePublishers);
  assertEntryVersions(context, entry, versions);

  const target = versions.find((version) => version.id === versionId);

  if (!target || target.status !== "draft") {
    throw new KnowledgeLifecycleError(
      "Only an existing draft version can be published.",
    );
  }

  const updatedVersions = versions.map((version): KnowledgeVersion => {
    if (version.id === target.id) {
      return { ...version, status: "published", publishedAt };
    }

    if (version.status === "published") {
      return { ...version, status: "superseded" };
    }

    return { ...version };
  });

  const updatedEntry: KnowledgeEntry = {
    ...entry,
    status: "published",
    activeVersionId: target.id,
    updatedAt: publishedAt,
  };

  return { entry: updatedEntry, versions: updatedVersions };
}

export function rollbackKnowledgeVersion(
  context: TenantContext,
  entry: KnowledgeEntry,
  versions: readonly KnowledgeVersion[],
  targetVersionId: KnowledgeVersionId,
  input: { id: KnowledgeVersionId; occurredAt: IsoTimestamp },
) {
  assertTenantRole(context, knowledgePublishers);
  assertEntryVersions(context, entry, versions);
  assertUniqueVersionId(versions, input.id);

  const target = versions.find((version) => version.id === targetVersionId);

  if (!target) {
    throw new KnowledgeLifecycleError(
      "The rollback target does not exist for this entry.",
    );
  }

  const nextRevision =
    versions.reduce(
      (highest, version) => Math.max(highest, version.revision),
      0,
    ) + 1;
  const rollbackVersion: KnowledgeVersion = {
    ...target,
    id: input.id,
    revision: nextRevision,
    status: "published",
    createdBy: context.actorId,
    createdAt: input.occurredAt,
    publishedAt: input.occurredAt,
  };
  const updatedVersions = [
    ...versions.map((version): KnowledgeVersion =>
      version.status === "published"
        ? { ...version, status: "superseded" }
        : { ...version },
    ),
    rollbackVersion,
  ];
  const updatedEntry: KnowledgeEntry = {
    ...entry,
    status: "published",
    activeVersionId: rollbackVersion.id,
    updatedAt: input.occurredAt,
  };

  return { entry: updatedEntry, versions: updatedVersions };
}

export function createAuditEvent(
  context: TenantContext,
  input: {
    id: AuditEventId;
    action: string;
    resourceType: string;
    resourceId: string;
    occurredAt: IsoTimestamp;
    metadata?: AuditEvent["metadata"];
  },
): AuditEvent {
  if (!input.action.trim() || !input.resourceType.trim() || !input.resourceId.trim()) {
    throw new KnowledgeLifecycleError(
      "Audit events require an action, resource type, and resource ID.",
    );
  }

  return {
    id: input.id,
    tenantId: context.tenantId,
    actorId: context.actorId,
    requestId: context.requestId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    occurredAt: input.occurredAt,
    metadata: input.metadata ?? {},
  };
}
