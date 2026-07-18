import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthSessionProvider, ProviderSessionResult } from "@reviva/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classifySupabaseAuthFailure } from "./session-status";

export class SupabaseSessionProvider implements AuthSessionProvider {
  constructor(private readonly client: SupabaseClient) {}

  async verify(): Promise<ProviderSessionResult> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      return { status: classifySupabaseAuthFailure(error.code, error.status) };
    }
    if (!data.user) return { status: "unauthenticated" };
    return {
      status: "authenticated",
      identity: {
        subject: data.user.id,
        expiresAt: null,
      },
    };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: "local" });
    return { error: Boolean(error) };
  }
}

export async function createSupabaseSessionProvider() {
  return new SupabaseSessionProvider(await createSupabaseServerClient());
}
