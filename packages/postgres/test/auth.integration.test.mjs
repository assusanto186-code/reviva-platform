import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  AmbiguousTenantSelectionError,
  TrustedTenantContextResolver,
} from "@reviva/auth";
import {
  PostgresAuthIdentityRepository,
  PostgresTransactionCoordinator,
  createPostgresClient,
  readIntegrationTestConfig,
} from "../dist/index.js";

const config = readIntegrationTestConfig();
const admin = createPostgresClient(config.adminUrl, { max: 2 });
const runtime = createPostgresClient(config.runtimeUrl, { max: 3 });
const repository = new PostgresAuthIdentityRepository(runtime);
const coordinator = new PostgresTransactionCoordinator(runtime);
const ids = {
  user: randomUUID(),
  tenantA: randomUUID(),
  tenantB: randomUUID(),
  membershipA: randomUUID(),
  membershipB: randomUUID(),
  request: randomUUID(),
};
const suffix = ids.user.slice(0, 8);
const subject = `fake-auth-subject-${ids.user}`;
const now = "2026-07-18T00:00:00.000Z";

async function cleanFixture() {
  await admin.begin(async (sql) => {
    await sql`delete from public.memberships where user_id=${ids.user}`;
    await sql`delete from public.users where id=${ids.user}`;
    await sql`delete from public.tenants where id in (${ids.tenantA},${ids.tenantB})`;
  });
}

before(async () => {
  await cleanFixture();
  await admin.begin(async (sql) => {
    await sql`insert into public.tenants(id,slug,name,status,created_at,updated_at) values
      (${ids.tenantA},${`fake-auth-${suffix}-a`},'Fake Auth Tenant A','active',${now},${now}),
      (${ids.tenantB},${`fake-auth-${suffix}-b`},'Fake Auth Tenant B','active',${now},${now})`;
    await sql`insert into public.users(id,auth_subject,email,display_name,status,created_at,updated_at)
      values(${ids.user},${subject},${`fake-auth-${suffix}@example.test`},'Fake Auth User','active',${now},${now})`;
    await sql`insert into public.memberships(id,tenant_id,user_id,role,status,created_at,updated_at)
      values(${ids.membershipA},${ids.tenantA},${ids.user},'manager','active',${now},${now})`;
  });
});

after(async () => {
  try { await cleanFixture(); }
  finally { await Promise.allSettled([admin.end(), runtime.end()]); }
});

test("restricted runtime resolves only minimum identity data", async () => {
  const record = await repository.resolveBySubject(subject);
  assert.deepEqual(record, {
    id: ids.user,
    displayName: "Fake Auth User",
    status: "active",
    memberships: [{
      tenantId: ids.tenantA,
      tenantName: "Fake Auth Tenant A",
      tenantStatus: "active",
      role: "manager",
      status: "active",
    }],
  });
  assert.equal(await repository.resolveBySubject(`missing-${subject}`), null);
  await assert.rejects(async () => { await runtime`select id from public.users`; });
});

test("resolved identity creates a context accepted by the restricted coordinator", async () => {
  const resolver = new TrustedTenantContextResolver(repository, () => ids.request);
  const trusted = await resolver.resolve({ subject, expiresAt: null });
  assert.equal(trusted.context.actorRole, "manager");
  assert.equal(trusted.context.tenantId, ids.tenantA);
  const tenant = await coordinator.run(
    trusted.context,
    (session) => session.tenants.getTenant(trusted.context, trusted.context.tenantId),
  );
  assert.equal(tenant?.name, "Fake Auth Tenant A");
});

test("multiple active memberships require validated tenant selection", async () => {
  await admin`insert into public.memberships(id,tenant_id,user_id,role,status,created_at,updated_at)
    values(${ids.membershipB},${ids.tenantB},${ids.user},'viewer','active',${now},${now})`;
  const resolver = new TrustedTenantContextResolver(repository, () => ids.request);
  await assert.rejects(
    resolver.resolve({ subject, expiresAt: null }),
    AmbiguousTenantSelectionError,
  );
  const selected = await resolver.resolve(
    { subject, expiresAt: null },
    { tenantHint: ids.tenantB },
  );
  assert.equal(selected.context.tenantId, ids.tenantB);
  assert.equal(selected.context.actorRole, "viewer");
});
