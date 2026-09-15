"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type FormState } from "../actions";

const initialState: FormState = { error: null };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <form action={formAction} className="card p-8 max-w-sm w-full space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Create your organization</h1>

        {state.error && (
          <p className="text-sm text-[var(--color-bad)]">{state.error}</p>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Organization name</span>
          <input
            name="orgName"
            type="text"
            required
            placeholder="e.g. Kamau Properties"
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">
            KRA PIN <span className="text-[var(--color-ink-400)]">(optional for now)</span>
          </span>
          <input name="kraPin" type="text" className="hairline w-full rounded-md px-3 py-2" />
        </label>

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
            minLength={8}
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
          {pending ? "Creating…" : "Create organization"}
        </button>

        <p className="text-sm text-[var(--color-ink-600)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-accent-500)]">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
