export function shouldRedirectToLogin(pathname: string, hasClaims: boolean) {
  const protectedPath = pathname === "/app" || pathname.startsWith("/app/");
  return protectedPath && !hasClaims;
}
