"use client";

import { useActionState } from "react";
import { createTenant, type FormState } from "../actions";

const initialState: FormState = { error: null };

export default function NewTenantPage() {
  const [state, formAction, pending] = useActionState(createTenant, initialState);

  return (
    <div className="flex justify-center">
      <form action={formAction} className="card p-8 max-w-md w-full space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">New tenant</h1>

        {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Full name</span>
          <input name="name" required className="hairline w-full rounded-md px-3 py-2" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Phone (M-Pesa number)</span>
          <input
            name="phone"
            required
            placeholder="0712 345 678"
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">
            Email <span className="text-[var(--color-ink-400)]">(optional)</span>
          </span>
          <input name="email" type="email" className="hairline w-full rounded-md px-3 py-2" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">
            ID/Passport number <span className="text-[var(--color-ink-400)]">(optional)</span>
          </span>
          <input name="idNumber" className="hairline w-full rounded-md px-3 py-2" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-[var(--color-ink-600)]">Emergency contact</span>
            <input
              name="emergencyContactName"
              className="hairline w-full rounded-md px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-[var(--color-ink-600)]">Contact phone</span>
            <input
              name="emergencyContactPhone"
              className="hairline w-full rounded-md px-3 py-2"
            />
          </label>
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
          {pending ? "Saving…" : "Save tenant"}
        </button>
      </form>
    </div>
  );
}
