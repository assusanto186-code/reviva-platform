import type { ProviderSessionResult } from "@reviva/auth";

export function classifySupabaseAuthFailure(
  code: string | undefined,
  status: number | undefined,
): Exclude<ProviderSessionResult["status"], "authenticated"> {
  const normalized = code?.toLowerCase() ?? "";
  if (normalized.includes("expired") || normalized.includes("refresh_token")) return "expired";
  if (normalized === "session_not_found" || status === 401) return "unauthenticated";
  return "invalid";
}
