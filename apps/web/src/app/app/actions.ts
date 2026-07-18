"use server";

import { redirect } from "next/navigation";
import { logoutSession } from "@reviva/auth";
import { createSupabaseSessionProvider } from "@/lib/auth/supabase-session";

export async function logout() {
  await logoutSession(await createSupabaseSessionProvider());
  redirect("/login");
}
