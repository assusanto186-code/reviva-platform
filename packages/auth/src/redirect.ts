import { UnsafeRedirectError } from "./errors.js";

export function validateAppRedirect(value: string | null | undefined) {
  if (!value) return "/app";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new UnsafeRedirectError();
  }
  const url = new URL(value, "https://reviva.invalid");
  if (
    url.origin !== "https://reviva.invalid" ||
    (url.pathname !== "/app" && !url.pathname.startsWith("/app/"))
  ) {
    throw new UnsafeRedirectError();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
