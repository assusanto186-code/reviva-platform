import { redirect } from "next/navigation";
import { AuthenticationError, ExpiredSessionError, InvalidSessionError, UnauthenticatedError } from "@reviva/auth";
import { Button } from "@/components/ui/button";
import { requireAppContext } from "@/lib/auth/dal";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

function SignOutButton() {
  return <form action={logout}><Button variant="secondary" type="submit">Sign out</Button></form>;
}

async function resolvePageContext() {
  try {
    return { status: "ready" as const, trusted: await requireAppContext() };
  } catch (error) {
    if (error instanceof UnauthenticatedError || error instanceof InvalidSessionError || error instanceof ExpiredSessionError) redirect("/login");
    if (error instanceof AuthenticationError) return { status: "unavailable" as const };
    throw error;
  }
}

export default async function AppPage() {
  const result = await resolvePageContext();
  if (result.status === "unavailable") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6"><section className="max-w-lg rounded-xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold">Account access unavailable</h1>
        <p className="mt-3 text-muted">Your sign-in is valid, but this account is not currently linked to an active Reviva workspace. Contact your administrator.</p>
        <div className="mt-6"><SignOutButton /></div>
      </section></main>
    );
  }
  const { trusted } = result;
  return (
    <main className="min-h-screen px-6 py-10"><div className="mx-auto max-w-5xl">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Reviva</p><h1 className="mt-2 text-2xl font-semibold">{trusted.tenantName}</h1></div>
        <SignOutButton />
      </header>
      <section className="mt-10 rounded-xl border border-border bg-surface p-8">
        <p className="text-sm text-muted">Protected workspace</p>
        <h2 className="mt-2 text-3xl font-semibold">Hello, {trusted.displayName}</h2>
        <p className="mt-4 text-muted">Your session and tenant membership have been verified on the server.</p>
        <p className="mt-6 inline-flex rounded-full border border-border px-3 py-1 text-sm text-muted">Role: {trusted.context.actorRole}</p>
      </section>
    </div></main>
  );
}
