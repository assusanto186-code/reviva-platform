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
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.");
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS.");
  }
  return { url, publishableKey } as const;
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
