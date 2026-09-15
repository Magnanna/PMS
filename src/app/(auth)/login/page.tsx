"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type FormState } from "../actions";

const initialState: FormState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <form action={formAction} className="card p-8 max-w-sm w-full space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>

        {state.error && (
          <p className="text-sm text-[var(--color-bad)]">{state.error}</p>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Email</span>
          <input
            name="email"
            type="email"
            required
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Password</span>
          <input
            name="password"
            type="password"
            required
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-sm text-[var(--color-ink-600)]">
          No account?{" "}
          <Link href="/signup" className="text-[var(--color-accent-500)]">
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
