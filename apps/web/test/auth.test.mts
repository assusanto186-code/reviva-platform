import assert from "node:assert/strict";
import { test } from "node:test";
import { exchangeAuthorizationCode } from "../src/lib/auth/callback.ts";
import { getSupabaseCookieOptions, readSupabasePublicConfig, readRuntimeDatabaseUrl } from "../src/lib/auth/config.ts";
import { classifySupabaseAuthFailure } from "../src/lib/auth/session-status.ts";
import { shouldRedirectToLogin } from "../src/lib/auth/access.ts";

test("protected app access redirects only when claims are absent", () => {
  assert.equal(shouldRedirectToLogin("/app", false), true);
  assert.equal(shouldRedirectToLogin("/app/settings", false), true);
  assert.equal(shouldRedirectToLogin("/app", true), false);
  assert.equal(shouldRedirectToLogin("/login", false), false);
  assert.equal(shouldRedirectToLogin("/application", false), false);
});

test("auth configuration fails closed without required values", () => {
  assert.throws(() => readSupabasePublicConfig({}), /NEXT_PUBLIC_SUPABASE_URL/);
  assert.throws(() => readRuntimeDatabaseUrl({}), /REVIVA_DB_RUNTIME_URL/);
  assert.throws(
    () => readSupabasePublicConfig({ NEXT_PUBLIC_SUPABASE_URL: "http://unsafe.example", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public" }),
    /HTTPS/,
  );
  assert.throws(
    () => readSupabasePublicConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fake" }),
    /must not contain/,
  );
  assert.deepEqual(
    readSupabasePublicConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public" }),
    { url: "https://project.supabase.co", publishableKey: "public" },
  );
});

test("authentication cookies become secure in production", () => {
  assert.deepEqual(getSupabaseCookieOptions({ NODE_ENV: "production" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
  assert.equal(getSupabaseCookieOptions({ NODE_ENV: "development" }).secure, false);
});

test("provider failures produce stable session categories", () => {
  assert.equal(classifySupabaseAuthFailure("session_not_found", 400), "unauthenticated");
  assert.equal(classifySupabaseAuthFailure("refresh_token_already_used", 400), "expired");
  assert.equal(classifySupabaseAuthFailure("unexpected", 400), "invalid");
});

test("authorization code exchange fails closed", async () => {
  assert.equal(await exchangeAuthorizationCode(null, async () => ({ error: null })), false);
  assert.equal(await exchangeAuthorizationCode("x".repeat(4097), async () => ({ error: null })), false);
  assert.equal(await exchangeAuthorizationCode("code", async () => ({ error: new Error("invalid") })), false);
  assert.equal(await exchangeAuthorizationCode("code", async () => ({ error: null })), true);
});
