import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { TrustedTenantContextResolver } from "@reviva/auth";
import { PostgresAuthIdentityRepository, PostgresTransactionCoordinator, createPostgresClient } from "@reviva/postgres";
import { readSupabasePublicConfig } from "../src/lib/auth/config.ts";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for hosted Auth integration.`);
  return value;
}

test("real Supabase session resolves a restricted trusted tenant context", async () => {
  assert.equal(required("REVIVA_DB_ENVIRONMENT"), "development");
  const projectRef = required("REVIVA_DB_TEST_PROJECT_REF");
  assert.notEqual(projectRef, process.env.REVIVA_DB_PRODUCTION_PROJECT_REF?.trim());
  const publicConfig = readSupabasePublicConfig(process.env);
  const runtime = createPostgresClient(required("REVIVA_DB_RUNTIME_URL"), { max: 1 });
  const supabase = createClient(
    publicConfig.url,
    publicConfig.publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  try {
    const signIn = await supabase.auth.signInWithPassword({
      email: required("REVIVA_AUTH_TEST_EMAIL"),
      password: required("REVIVA_AUTH_TEST_PASSWORD"),
    });
    assert.equal(signIn.error, null);
    assert.ok(signIn.data.session);
    const verified = await supabase.auth.getUser();
    assert.equal(verified.error, null);
    assert.ok(verified.data.user);

    const repository = new PostgresAuthIdentityRepository(runtime);
    const trusted = await new TrustedTenantContextResolver(repository, randomUUID).resolve({
      subject: verified.data.user.id,
      expiresAt: signIn.data.session.expires_at ?? null,
    });
    const coordinator = new PostgresTransactionCoordinator(runtime);
    const tenant = await coordinator.run(trusted.context, (session) =>
      session.tenants.getTenant(trusted.context, trusted.context.tenantId),
    );
    assert.equal(tenant?.name, trusted.tenantName);
    assert.equal((await supabase.auth.signOut({ scope: "local" })).error, null);
    assert.equal((await supabase.auth.getSession()).data.session, null);
  } finally {
    await runtime.end();
  }
});
