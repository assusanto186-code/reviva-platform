import {
  ExpiredSessionError,
  InvalidSessionError,
  LogoutError,
  UnauthenticatedError,
} from "./errors.js";

export type VerifiedAuthIdentity = Readonly<{
  subject: string;
  expiresAt: number | null;
}>;

export type ProviderSessionResult =
  | Readonly<{ status: "authenticated"; identity: VerifiedAuthIdentity }>
  | Readonly<{ status: "unauthenticated" | "invalid" | "expired" }>;

export interface AuthSessionProvider {
  verify(): Promise<ProviderSessionResult>;
  signOut(): Promise<{ error: boolean }>;
}

export async function verifySession(
  provider: Pick<AuthSessionProvider, "verify">,
): Promise<VerifiedAuthIdentity> {
  const result = await provider.verify();
  switch (result.status) {
    case "authenticated":
      if (!result.identity.subject.trim()) throw new InvalidSessionError();
      return result.identity;
    case "unauthenticated":
      throw new UnauthenticatedError();
    case "expired":
      throw new ExpiredSessionError();
    case "invalid":
      throw new InvalidSessionError();
  }
}

export async function logoutSession(
  provider: Pick<AuthSessionProvider, "signOut">,
) {
  const result = await provider.signOut();
  if (result.error) throw new LogoutError();
}
