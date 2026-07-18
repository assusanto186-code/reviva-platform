"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, { message: "" });
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <label className="block text-sm font-medium">Email
        <input className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block text-sm font-medium">Password
        <input className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.message ? <p role="alert" className="text-sm text-danger">{state.message}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</Button>
    </form>
  );
}
