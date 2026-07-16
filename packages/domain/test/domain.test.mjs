import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryAuditRepository,
  InMemoryKnowledgeRepository,
  InMemoryTenantRepository,
  TenantAccessError,
  TenantPermissionError,
  auditEventId,
  createAuditEvent,
  createDraftVersion,
  knowledgeEntryId,
  knowledgeSourceId,
  knowledgeVersionId,
  locationId,
  membershipId,
  organizationId,
  publishKnowledgeVersion,
  requestId,
  rollbackKnowledgeVersion,
  tenantId,
  userId,
} from "../dist/index.js";

const now = "2026-07-15T00:00:00.000Z";
const later = "2026-07-15T01:00:00.000Z";
const latest = "2026-07-15T02:00:00.000Z";

function createContext(tenant, actor, role = "owner") {
  return {
    tenantId: tenant,
    actorId: actor,
    actorRole: role,
    requestId: requestId(`request-${tenant}`),
  };
}

test("tenant repositories isolate organizations, locations, and memberships", async () => {
  const repository = new InMemoryTenantRepository();
  const tenantA = tenantId("tenant-a");
  const tenantB = tenantId("tenant-b");
  const ownerA = userId("user-owner-a");
  const ownerB = userId("user-owner-b");
  const contextA = createContext(tenantA, ownerA);
  const contextB = createContext(tenantB, ownerB);
  const organizationA = {
    id: organizationId("organization-a"),
    tenantId: tenantA,
    name: "Example Med Spa",
    legalName: null,
    timezone: "America/New_York",
    createdAt: now,
    updatedAt: now,
  };
  const locationA = {
    id: locationId("location-a"),
    tenantId: tenantA,
    organizationId: organizationA.id,
    name: "Downtown",
    timezone: "America/New_York",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const membershipA = {
    id: membershipId("membership-a"),
    tenantId: tenantA,
    userId: ownerA,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await repository.saveTenant(contextA, {
    id: tenantA,
    slug: "example-med-spa",
    name: "Example Med Spa",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  await repository.saveOrganization(contextA, organizationA);
  await repository.saveLocation(contextA, locationA);
  await repository.saveMembership(contextA, membershipA);

  assert.equal((await repository.getOrganization(contextA, organizationA.id))?.name, "Example Med Spa");
  assert.equal((await repository.listLocations(contextA, organizationA.id)).length, 1);
  assert.equal((await repository.getMembership(contextA, membershipA.id))?.role, "owner");
  assert.equal(await repository.getOrganization(contextB, organizationA.id), null);
  assert.equal((await repository.listLocations(contextB, organizationA.id)).length, 0);
  assert.equal(await repository.getMembership(contextB, membershipA.id), null);
  await assert.rejects(
    repository.getTenant(contextB, tenantA),
    TenantAccessError,
  );
  await assert.rejects(
    repository.saveOrganization(contextB, organizationA),
    TenantAccessError,
  );
});

test("knowledge repositories never return another tenant's records", async () => {
  const repository = new InMemoryKnowledgeRepository();
  const tenantA = tenantId("tenant-a");
  const tenantB = tenantId("tenant-b");
  const contextA = createContext(tenantA, userId("user-a"));
  const contextB = createContext(tenantB, userId("user-b"));
  const source = {
    id: knowledgeSourceId("source-a"),
    tenantId: tenantA,
    locationId: null,
    kind: "operator",
    name: "Approved service guide",
    uri: null,
    ownerUserId: contextA.actorId,
    status: "active",
    lastVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const entry = {
    id: knowledgeEntryId("entry-a"),
    tenantId: tenantA,
    sourceId: source.id,
    locationId: null,
    key: "consultation.preparation",
    title: "Consultation preparation",
    status: "draft",
    activeVersionId: null,
    createdAt: now,
    updatedAt: now,
  };
  const version = createDraftVersion(contextA, entry, [], {
    id: knowledgeVersionId("version-a-1"),
    content: "Arrive ten minutes before the consultation.",
    sourceLocator: "Operator guide section 2",
    createdAt: now,
    verifiedAt: now,
  });

  await repository.saveSource(contextA, source);
  await repository.saveEntry(contextA, entry);
  await repository.saveVersion(contextA, version);

  assert.equal((await repository.getSource(contextA, source.id))?.name, source.name);
  assert.equal((await repository.listVersions(contextA, entry.id)).length, 1);
  assert.equal(await repository.getSource(contextB, source.id), null);
  assert.equal(await repository.getEntry(contextB, entry.id), null);
  assert.equal((await repository.listVersions(contextB, entry.id)).length, 0);
  await assert.rejects(repository.saveEntry(contextB, entry), TenantAccessError);
});

test("knowledge publishing and rollback preserve immutable history", () => {
  const tenant = tenantId("tenant-a");
  const context = createContext(tenant, userId("manager-a"), "manager");
  const entry = {
    id: knowledgeEntryId("entry-a"),
    tenantId: tenant,
    sourceId: knowledgeSourceId("source-a"),
    locationId: null,
    key: "hours.monday",
    title: "Monday hours",
    status: "draft",
    activeVersionId: null,
    createdAt: now,
    updatedAt: now,
  };
  const versionOne = createDraftVersion(context, entry, [], {
    id: knowledgeVersionId("version-1"),
    content: "Open 9 AM to 5 PM.",
    sourceLocator: "Operations handbook",
    createdAt: now,
    verifiedAt: now,
  });
  const firstPublish = publishKnowledgeVersion(
    context,
    entry,
    [versionOne],
    versionOne.id,
    later,
  );
  const versionTwo = createDraftVersion(
    context,
    firstPublish.entry,
    firstPublish.versions,
    {
      id: knowledgeVersionId("version-2"),
      content: "Open 9 AM to 6 PM.",
      sourceLocator: "Operations handbook revision 2",
      createdAt: latest,
      verifiedAt: latest,
    },
  );
  const secondPublish = publishKnowledgeVersion(
    context,
    firstPublish.entry,
    [...firstPublish.versions, versionTwo],
    versionTwo.id,
    latest,
  );
  const rollback = rollbackKnowledgeVersion(
    context,
    secondPublish.entry,
    secondPublish.versions,
    versionOne.id,
    {
      id: knowledgeVersionId("version-3"),
      occurredAt: "2026-07-15T03:00:00.000Z",
    },
  );

  assert.equal(versionOne.revision, 1);
  assert.equal(versionTwo.revision, 2);
  assert.equal(secondPublish.entry.activeVersionId, versionTwo.id);
  assert.equal(
    secondPublish.versions.find((version) => version.id === versionOne.id)?.status,
    "superseded",
  );
  assert.equal(rollback.versions.length, 3);
  assert.equal(rollback.versions.at(-1)?.revision, 3);
  assert.equal(rollback.versions.at(-1)?.content, versionOne.content);
  assert.equal(rollback.versions.at(-1)?.status, "published");
  assert.equal(
    rollback.versions.filter((version) => version.status === "published").length,
    1,
  );
  assert.notEqual(rollback.entry.activeVersionId, versionOne.id);
});

test("viewers cannot publish knowledge", () => {
  const tenant = tenantId("tenant-a");
  const editorContext = createContext(tenant, userId("editor-a"), "agent");
  const viewerContext = createContext(tenant, userId("viewer-a"), "viewer");
  const entry = {
    id: knowledgeEntryId("entry-a"),
    tenantId: tenant,
    sourceId: knowledgeSourceId("source-a"),
    locationId: null,
    key: "policy.cancellation",
    title: "Cancellation policy",
    status: "draft",
    activeVersionId: null,
    createdAt: now,
    updatedAt: now,
  };
  const draft = createDraftVersion(editorContext, entry, [], {
    id: knowledgeVersionId("version-a"),
    content: "Contact the med spa to discuss a cancellation.",
    sourceLocator: null,
    createdAt: now,
    verifiedAt: null,
  });

  assert.throws(
    () => publishKnowledgeVersion(viewerContext, entry, [draft], draft.id, later),
    TenantPermissionError,
  );
});

test("audit events are immutable and tenant scoped", async () => {
  const repository = new InMemoryAuditRepository();
  const tenantA = tenantId("tenant-a");
  const tenantB = tenantId("tenant-b");
  const contextA = createContext(tenantA, userId("owner-a"));
  const contextB = createContext(tenantB, userId("owner-b"));
  const event = createAuditEvent(contextA, {
    id: auditEventId("audit-a"),
    action: "knowledge.version.published",
    resourceType: "knowledge-entry",
    resourceId: "entry-a",
    occurredAt: now,
    metadata: { revision: 1 },
  });

  await repository.append(contextA, event);

  const tenantAEvents = await repository.list(contextA);
  tenantAEvents[0].metadata.revision = 99;

  assert.equal((await repository.list(contextA))[0].metadata.revision, 1);
  assert.equal((await repository.list(contextB)).length, 0);
  await assert.rejects(repository.append(contextB, event), TenantAccessError);
});
