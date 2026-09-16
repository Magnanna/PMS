"use client";

import { useActionState } from "react";
import { createProperty, type FormState } from "../actions";

const initialState: FormState = { error: null };

export default function NewPropertyPage() {
  const [state, formAction, pending] = useActionState(createProperty, initialState);

  return (
    <div className="flex justify-center">
      <form action={formAction} className="card p-8 max-w-md w-full space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">New property</h1>

        {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Name</span>
          <input name="name" required className="hairline w-full rounded-md px-3 py-2" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Address</span>
          <input name="address" required className="hairline w-full rounded-md px-3 py-2" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">County</span>
          <input name="county" className="hairline w-full rounded-md px-3 py-2" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Type</span>
          <select name="type" className="hairline w-full rounded-md px-3 py-2">
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
          {pending ? "Saving…" : "Save property"}
        </button>
      </form>
    </div>
  );
}
