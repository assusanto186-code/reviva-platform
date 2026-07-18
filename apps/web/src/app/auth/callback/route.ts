import { NextResponse, type NextRequest } from "next/server";
import { validateAppRedirect } from "@reviva/auth";
import { exchangeAuthorizationCode } from "@/lib/auth/callback";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  let destination: string;
  try {
    destination = validateAppRedirect(request.nextUrl.searchParams.get("next"));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_redirect", request.url));
  }
  const supabase = await createSupabaseServerClient();
  const exchanged = await exchangeAuthorizationCode(
    request.nextUrl.searchParams.get("code"),
    (code) => supabase.auth.exchangeCodeForSession(code),
  );
  if (!exchanged) return NextResponse.redirect(new URL("/login?error=invalid_callback", request.url));
  return NextResponse.redirect(new URL(destination, request.url));
}
