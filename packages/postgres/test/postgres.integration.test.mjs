import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  auditEventId, createAuditEvent, createDraftVersion, knowledgeEntryId,
  knowledgeSourceId, knowledgeVersionId, organizationId,
  publishKnowledgeVersion, requestId, rollbackKnowledgeVersion, tenantId, userId,
} from "@reviva/domain";
import {
  InvalidTenantContextError, OptimisticLockError,
  PostgresTransactionCoordinator, TransactionSessionClosedError,
  createPostgresClient, readIntegrationTestConfig,
} from "../dist/index.js";

const config = readIntegrationTestConfig();
const admin = createPostgresClient(config.adminUrl, { max: 3 });
const runtime = createPostgresClient(config.runtimeUrl, { max: 6 });
const coordinator = new PostgresTransactionCoordinator(runtime);
const now = "2026-07-16T00:00:00.000Z";
const ids = {
  tenantA:randomUUID(), tenantB:randomUUID(), userA:randomUUID(), userB:randomUUID(),
  memberA:randomUUID(), memberB:randomUUID(), orgA:randomUUID(), orgB:randomUUID(),
  sourceA:randomUUID(), entryA:randomUUID(),
};
const suffix=ids.tenantA.slice(0,8);
const contextA={tenantId:tenantId(ids.tenantA),actorId:userId(ids.userA),actorRole:"owner",requestId:requestId(randomUUID())};
const contextB={tenantId:tenantId(ids.tenantB),actorId:userId(ids.userB),actorRole:"owner",requestId:requestId(randomUUID())};
const orgA={id:organizationId(ids.orgA),tenantId:contextA.tenantId,name:"Fake Tenant A Spa",legalName:null,timezone:"America/New_York",createdAt:now,updatedAt:now};
const orgB={id:organizationId(ids.orgB),tenantId:contextB.tenantId,name:"Fake Tenant B Spa",legalName:null,timezone:"America/Chicago",createdAt:now,updatedAt:now};

async function setContext(sql, context) {
  await sql`select reviva_private.set_tenant_context(${context.tenantId}::uuid,${context.actorId}::uuid,${context.actorRole}::text,${context.requestId}::uuid)`;
}

async function cleanFixture() {
  await admin.begin(async sql=>{
    await sql`delete from public.audit_events where tenant_id in (${ids.tenantA},${ids.tenantB})`;
    await sql`update public.knowledge_entries set active_version_id=null where tenant_id in (${ids.tenantA},${ids.tenantB})`;
    await sql`delete from public.knowledge_versions where tenant_id in (${ids.tenantA},${ids.tenantB})`;
    await sql`delete from public.knowledge_entries where tenant_id in (${ids.tenantA},${ids.tenantB})`;
    await sql`delete from public.knowledge_sources where tenant_id in (${ids.tenantA},${ids.tenantB})`;
    await sql`delete from public.organizations where tenant_id in (${ids.tenantA},${ids.tenantB})`;
    await sql`delete from public.memberships where tenant_id in (${ids.tenantA},${ids.tenantB})`;
    await sql`delete from public.users where id in (${ids.userA},${ids.userB})`;
    await sql`delete from public.tenants where id in (${ids.tenantA},${ids.tenantB})`;
  });
}

before(async()=>{
  await cleanFixture();
  await admin.begin(async sql=>{
    await sql`insert into public.tenants(id,slug,name,status,created_at,updated_at) values
      (${ids.tenantA},${`fake-${suffix}-a`},'Fake Tenant A','active',${now},${now}),
      (${ids.tenantB},${`fake-${suffix}-b`},'Fake Tenant B','active',${now},${now})`;
    await sql`insert into public.users(id,auth_subject,email,display_name,status,created_at,updated_at) values
      (${ids.userA},${`fake-auth-${suffix}-a`},${`fake-${suffix}-a@example.test`},'Fake Owner A','active',${now},${now}),
      (${ids.userB},${`fake-auth-${suffix}-b`},${`fake-${suffix}-b@example.test`},'Fake Owner B','active',${now},${now})`;
    await sql`insert into public.memberships(id,tenant_id,user_id,role,status,created_at,updated_at) values
      (${ids.memberA},${ids.tenantA},${ids.userA},'owner','active',${now},${now}),
      (${ids.memberB},${ids.tenantB},${ids.userB},'owner','active',${now},${now})`;
    await sql`insert into public.organizations(id,tenant_id,name,legal_name,timezone,created_at,updated_at) values
      (${ids.orgA},${ids.tenantA},${orgA.name},null,${orgA.timezone},${now},${now}),
      (${ids.orgB},${ids.tenantB},${orgB.name},null,${orgB.timezone},${now},${now})`;
    await sql`insert into public.knowledge_sources(id,tenant_id,kind,name,owner_user_id,status,created_at,updated_at)
      values(${ids.sourceA},${ids.tenantA},'operator','Fake Guide',${ids.userA},'active',${now},${now})`;
    await sql`insert into public.knowledge_entries(id,tenant_id,source_id,key,title,status,created_at,updated_at)
      values(${ids.entryA},${ids.tenantA},${ids.sourceA},${`fake.${suffix}.hours`},'Fake hours','draft',${now},${now})`;
  });
});

after(async()=>{
  try { await cleanFixture(); }
  finally { await Promise.all([admin.end(),runtime.end()]); }
});

test("Tenant A cannot read Tenant B and query paths remain scoped",async()=>{
  await coordinator.run(contextA,async s=>{
    assert.equal((await s.tenants.getOrganization(contextA,orgA.id))?.name,orgA.name);
    assert.equal(await s.tenants.getOrganization(contextA,orgB.id),null);
    assert.deepEqual(await s.tenants.listLocations(contextA,orgB.id),[]);
  });
});

test("Tenant A cannot update or delete Tenant B",async()=>{
  await runtime.begin(async sql=>{ await setContext(sql,contextA);
    const updated=await sql`update public.organizations set name='Blocked' where id=${ids.orgB} returning id`;
    assert.equal(updated.length,0);
  });
  await assert.rejects(()=>runtime.begin(async sql=>{
    await setContext(sql,contextA);
    await sql`delete from public.organizations where id=${ids.orgB}`;
  }));
});

test("missing, malformed, and unauthorized tenant context is rejected",async()=>{
  await assert.rejects(coordinator.run({...contextA,tenantId:tenantId("not-a-uuid")},async()=>undefined),InvalidTenantContextError);
  await assert.rejects(coordinator.run({...contextA,tenantId:tenantId(ids.tenantB)},async()=>undefined),InvalidTenantContextError);
  await runtime.begin(async sql=>{ assert.equal((await sql`select id from public.organizations`).length,0); });
  const blockedId=randomUUID();
  await assert.rejects(()=>runtime.begin(async sql=>{
    await sql`insert into public.organizations(id,tenant_id,name,timezone,created_at,updated_at)
      values(${blockedId},${ids.tenantA},'Blocked missing context','UTC',${now},${now})`;
  }));
});

test("runtime role cannot bypass forced RLS",async()=>{
  await assert.rejects(()=>runtime.begin(async sql=>{ await setContext(sql,contextA);
    await sql`set local row_security = off`;
    await sql`select id from public.organizations`;
  }));
});

test("runtime role cannot perform administrative operations",async()=>{
  await assert.rejects(async()=>{await runtime`alter table public.organizations disable row level security`;});
  await assert.rejects(async()=>{await runtime`create table public.reviva_blocked_admin_operation(id uuid)`;});
});

test("domain mutation and audit commit atomically",async()=>{
  const org={...orgA,id:organizationId(randomUUID()),name:"Fake Atomic Spa"};
  const event=createAuditEvent(contextA,{id:auditEventId(randomUUID()),action:"organization.created",resourceType:"organization",resourceId:org.id,occurredAt:now});
  await coordinator.run(contextA,async s=>{await s.tenants.saveOrganization(contextA,org);await s.audit.append(contextA,event);});
  await coordinator.run(contextA,async s=>{assert.ok(await s.tenants.getOrganization(contextA,org.id));assert.ok((await s.audit.list(contextA)).some(e=>e.id===event.id));});
});

test("domain mutation and audit both roll back on failure",async()=>{
  const org={...orgA,id:organizationId(randomUUID()),name:"Fake Rollback Spa"};
  const event=createAuditEvent(contextA,{id:auditEventId(randomUUID()),action:"organization.created",resourceType:"organization",resourceId:org.id,occurredAt:now});
  await assert.rejects(coordinator.run(contextA,async s=>{await s.tenants.saveOrganization(contextA,org);await s.audit.append(contextA,event);throw new Error("forced rollback");}));
  await coordinator.run(contextA,async s=>{assert.equal(await s.tenants.getOrganization(contextA,org.id),null);assert.ok(!(await s.audit.list(contextA)).some(e=>e.id===event.id));});
});

test("concurrent writes produce an optimistic-lock conflict",async()=>{
  const base=await coordinator.run(contextA,s=>s.knowledge.getEntry(contextA,knowledgeEntryId(ids.entryA)));
  assert.ok(base);
  const results=await Promise.allSettled([
    coordinator.run(contextA,s=>s.knowledge.saveEntryWithExpectedVersion(contextA,{...base,title:"Writer one"},1)),
    coordinator.run(contextA,s=>s.knowledge.saveEntryWithExpectedVersion(contextA,{...base,title:"Writer two"},1)),
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.ok(results.some(r=>r.status==="rejected"&&r.reason instanceof OptimisticLockError));
});

test("immutable knowledge version content cannot be mutated",async()=>{
  const version=randomUUID();
  await coordinator.run(contextA,async s=>s.knowledge.saveVersion(contextA,{id:knowledgeVersionId(version),tenantId:contextA.tenantId,entryId:knowledgeEntryId(ids.entryA),sourceId:knowledgeSourceId(ids.sourceA),revision:20,content:"Fake immutable content",sourceLocator:null,status:"draft",createdBy:contextA.actorId,createdAt:now,publishedAt:null,verifiedAt:null}));
  await assert.rejects(()=>runtime.begin(async sql=>{await setContext(sql,contextA);await sql`update public.knowledge_versions set content='Mutated' where id=${version}`;}));
});

test("tenant ownership cannot be changed",async()=>{
  await assert.rejects(()=>runtime.begin(async sql=>{
    await setContext(sql,contextA);
    await sql`update public.organizations set tenant_id=${ids.tenantB} where id=${ids.orgA}`;
  }));
  await coordinator.run(contextA,async s=>assert.equal((await s.tenants.getOrganization(contextA,orgA.id))?.tenantId,contextA.tenantId));
});

test("publish, supersede, and rollback lifecycle persists",async()=>{
  const entryId=knowledgeEntryId(randomUUID());
  const entry={id:entryId,tenantId:contextA.tenantId,sourceId:knowledgeSourceId(ids.sourceA),locationId:null,key:`fake.${suffix}.lifecycle`,title:"Fake lifecycle",status:"draft",activeVersionId:null,createdAt:now,updatedAt:now};
  const one=createDraftVersion(contextA,entry,[],{id:knowledgeVersionId(randomUUID()),content:"Fake version one",sourceLocator:null,createdAt:now,verifiedAt:null});
  const first=publishKnowledgeVersion(contextA,entry,[one],one.id,"2026-07-16T01:00:00.000Z");
  const two=createDraftVersion(contextA,first.entry,first.versions,{id:knowledgeVersionId(randomUUID()),content:"Fake version two",sourceLocator:null,createdAt:"2026-07-16T02:00:00.000Z",verifiedAt:null});
  const second=publishKnowledgeVersion(contextA,first.entry,[...first.versions,two],two.id,"2026-07-16T03:00:00.000Z");
  const rollback=rollbackKnowledgeVersion(contextA,second.entry,second.versions,one.id,{id:knowledgeVersionId(randomUUID()),occurredAt:"2026-07-16T04:00:00.000Z"});
  await coordinator.run(contextA,async s=>{await s.knowledge.saveEntry(contextA,entry);await s.knowledge.saveVersions(contextA,rollback.versions);await s.knowledge.saveEntry(contextA,rollback.entry);});
  const persisted=await coordinator.run(contextA,async s=>({entry:await s.knowledge.getEntry(contextA,entryId),versions:await s.knowledge.listVersions(contextA,entryId)}));
  assert.equal(persisted.versions.length,3);
  assert.equal(persisted.versions.filter(v=>v.status==="published").length,1);
  assert.ok(persisted.versions.some(v=>v.status==="superseded"));
  assert.equal(persisted.entry?.activeVersionId,rollback.entry.activeVersionId);
});

test("repository session cannot be reused after commit",async()=>{
  let escaped;
  await coordinator.run(contextA,async s=>{escaped=s;});
  await assert.rejects(escaped.tenants.getOrganization(contextA,orgA.id),TransactionSessionClosedError);
});

test("transaction-local context does not leak after commit or rollback",async()=>{
  await coordinator.run(contextA,async s=>assert.ok(await s.tenants.getOrganization(contextA,orgA.id)));
  await runtime.begin(async sql=>assert.equal((await sql`select id from public.organizations`).length,0));
  await assert.rejects(coordinator.run(contextA,async()=>{throw new Error("forced context rollback");}));
  await runtime.begin(async sql=>assert.equal((await sql`select id from public.organizations`).length,0));
});
