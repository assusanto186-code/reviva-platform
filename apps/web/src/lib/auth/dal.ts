import "server-only";

import { randomUUID } from "node:crypto";
import { AuthenticationError, TrustedTenantContextResolver, verifySession, type TrustedAuthContext } from "@reviva/auth";
import { getAuthDatabaseServices } from "./database";
import { createSupabaseSessionProvider } from "./supabase-session";

export async function requireAppContext(): Promise<TrustedAuthContext> {
  const identity = await verifySession(await createSupabaseSessionProvider());
  const { identities, transactions } = getAuthDatabaseServices();
  const trusted = await new TrustedTenantContextResolver(identities, randomUUID).resolve(identity);
  const tenant = await transactions.run(trusted.context, (session) =>
    session.tenants.getTenant(trusted.context, trusted.context.tenantId),
  );
  if (!tenant) throw new AuthenticationError("Tenant access validation failed.");
  return trusted;
}
