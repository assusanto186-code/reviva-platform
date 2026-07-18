"use server";

import { redirect } from "next/navigation";
import { validateAppRedirect } from "@reviva/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = Readonly<{ message: string }>;

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const nextValue = formData.get("next");
  if (typeof email !== "string" || typeof password !== "string") {
    return { message: "Enter your email and password." };
  }
  const normalizedEmail = email.trim();
  if (!normalizedEmail || normalizedEmail.length > 320 || !password || password.length > 1024) {
    return { message: "Enter a valid email and password." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) return { message: "Email or password is incorrect." };

  let destination = "/app";
  try {
    destination = validateAppRedirect(
      typeof nextValue === "string" ? nextValue : undefined,
    );
  } catch {
    destination = "/app";
  }
  redirect(destination);
}
