import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseCookieOptions, readSupabasePublicConfig } from "@/lib/auth/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const config = readSupabasePublicConfig();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot mutate cookies. Proxy performs refreshes.
        }
      },
    },
  });
}
