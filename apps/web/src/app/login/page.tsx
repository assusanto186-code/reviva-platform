import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Reviva</p>
        <h1 className="mt-3 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-3 text-sm text-muted">Sign in to your protected workspace.</p>
        <LoginForm next={next} />
      </section>
    </main>
  );
}
