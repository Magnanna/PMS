"use client";

import { useActionState } from "react";
import { claimTenantAccount, type ClaimState } from "./actions";

const initialState: ClaimState = { error: null };

export function ClaimForm({ token }: { token: string }) {
  const boundAction = claimTenantAccount.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
      </label>

      <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
        {pending ? "Setting up…" : "Access my portal"}
      </button>
    </form>
  );
}
