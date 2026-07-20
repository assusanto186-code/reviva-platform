import { Buffer } from "node:buffer";

type Environment = Readonly<Record<string, string | undefined>>;

function required(env: Environment, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function readSupabasePublicConfig(env: Environment = process.env) {
  const url = required(env, "NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = required(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (isServerSecretKey(publishableKey)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not contain a secret or service-role key.");
  }
  validateSupabaseProjectRootUrl(url, {
    allowLocalDevelopment: env.NODE_ENV === "development",
  });
  return { url, publishableKey } as const;
}

export function validateSupabaseProjectRootUrl(
  value: string,
  options: Readonly<{ allowLocalDevelopment?: boolean }> = {},
) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must not contain credentials.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a root project origin without path, query, or fragment.");
  }

  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (local) {
    if (!options.allowLocalDevelopment || parsed.protocol !== "http:") {
      throw new Error("Local Supabase HTTP requires explicit Development approval.");
    }
    return value;
  }
  if (parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS.");
  }
  if (parsed.port || !/^[a-z0-9-]+\.supabase\.co$/iu.test(parsed.hostname)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use the hosted Supabase project host shape.");
  }
  return value;
}

function isServerSecretKey(value: string) {
  if (value.startsWith("sb_secret_")) return true;
  const payload = value.split(".")[1];
  if (!payload) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role === "service_role";
  } catch {
    return false;
  }
}

export function getSupabaseCookieOptions(env: Environment = process.env) {
  return { httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/" };
}

export function readRuntimeDatabaseUrl(env: Environment = process.env) {
  return required(env, "REVIVA_DB_RUNTIME_URL");
}
