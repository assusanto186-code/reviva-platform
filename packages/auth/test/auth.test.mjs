import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AmbiguousTenantSelectionError,
  DomainUserNotFoundError,
  ExpiredSessionError,
  InactiveMembershipError,
  InactiveUserError,
  InvalidSessionError,
  LogoutError,
  MembershipNotFoundError,
  TenantAccessDeniedError,
  TrustedTenantContextResolver,
  UnauthenticatedError,
  UnsafeRedirectError,
  logoutSession,
  validateAppRedirect,
  verifySession,
} from "../dist/index.js";

const tenantA = "10000000-0000-4000-8000-000000000001";
const tenantB = "10000000-0000-4000-8000-000000000002";
const user = "20000000-0000-4000-8000-000000000001";
const request = "70000000-0000-4000-8000-000000000001";
const identity = { subject: "provider-user-a", expiresAt: 2_000_000_000 };
const membership = {
  tenantId: tenantA,
  tenantName: "Fake Tenant A",
  tenantStatus: "active",
  role: "manager",
  status: "active",
};
const activeUser = {
  id: user,
  displayName: "Fake Manager",
  status: "active",
  memberships: [membership],
};

function resolver(record) {
  return new TrustedTenantContextResolver(
    { resolveBySubject: async () => record },
    () => request,
  );
}

test("valid authenticated session is accepted", async () => {
  assert.deepEqual(
    await verifySession({ verify: async () => ({ status: "authenticated", identity }) }),
    identity,
  );
});

test("missing, invalid, and expired sessions fail with typed errors", async () => {
  await assert.rejects(
    verifySession({ verify: async () => ({ status: "unauthenticated" }) }),
    UnauthenticatedError,
  );
  await assert.rejects(
    verifySession({ verify: async () => ({ status: "invalid" }) }),
    InvalidSessionError,
  );
  await assert.rejects(
    verifySession({ verify: async () => ({ status: "expired" }) }),
    ExpiredSessionError,
  );
});

test("unprovisioned and inactive Reviva users fail closed", async () => {
  await assert.rejects(resolver(null).resolve(identity), DomainUserNotFoundError);
  await assert.rejects(
    resolver({ ...activeUser, status: "disabled" }).resolve(identity),
    InactiveUserError,
  );
});

test("missing and inactive memberships fail closed", async () => {
  await assert.rejects(
    resolver({ ...activeUser, memberships: [] }).resolve(identity),
    MembershipNotFoundError,
  );
  await assert.rejects(
    resolver({
      ...activeUser,
      memberships: [{ ...membership, status: "disabled" }],
    }).resolve(identity),
    InactiveMembershipError,
  );
});

test("suspended tenant and tenant mismatch are denied", async () => {
  await assert.rejects(
    resolver({
      ...activeUser,
      memberships: [{ ...membership, tenantStatus: "suspended" }],
    }).resolve(identity),
    TenantAccessDeniedError,
  );
  await assert.rejects(
    resolver(activeUser).resolve(identity, { tenantHint: tenantB }),
    TenantAccessDeniedError,
  );
});

test("ambiguous tenant access requires an explicit validated selection", async () => {
  const record = {
    ...activeUser,
    memberships: [membership, { ...membership, tenantId: tenantB, tenantName: "Fake B" }],
  };
  await assert.rejects(resolver(record).resolve(identity), AmbiguousTenantSelectionError);
  assert.equal(
    (await resolver(record).resolve(identity, { tenantHint: tenantB })).context.tenantId,
    tenantB,
  );
});

test("trusted context derives actor, tenant, and role only from persistence", async () => {
  const result = await resolver(activeUser).resolve({
    ...identity,
    tenantId: tenantB,
    role: "owner",
  });
  assert.deepEqual(result.context, {
    tenantId: tenantA,
    actorId: user,
    actorRole: "manager",
    requestId: request,
  });
  assert.equal(result.tenantName, "Fake Tenant A");
});

test("safe app redirects are accepted and external redirects are rejected", () => {
  assert.equal(validateAppRedirect(undefined), "/app");
  assert.equal(validateAppRedirect("/app/settings?tab=profile"), "/app/settings?tab=profile");
  for (const unsafe of ["https://evil.example", "//evil.example", "/login", "/application", "/app\\evil"]) {
    assert.throws(() => validateAppRedirect(unsafe), UnsafeRedirectError);
  }
});

test("logout reports success only after the provider clears the session", async () => {
  let cleared = false;
  await logoutSession({ signOut: async () => { cleared = true; return { error: false }; } });
  assert.equal(cleared, true);
  await assert.rejects(
    logoutSession({ signOut: async () => ({ error: true }) }),
    LogoutError,
  );
});
