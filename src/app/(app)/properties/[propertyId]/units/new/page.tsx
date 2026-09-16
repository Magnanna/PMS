"use client";

import { use, useActionState } from "react";
import { createUnit, type FormState } from "../actions";

const initialState: FormState = { error: null };

export default function NewUnitPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = use(params);
  const boundCreateUnit = createUnit.bind(null, propertyId);
  const [state, formAction, pending] = useActionState(boundCreateUnit, initialState);

  return (
    <div className="flex justify-center">
      <form action={formAction} className="card p-8 max-w-md w-full space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">New unit</h1>

        {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Unit number</span>
          <input
            name="unitNumber"
            required
            placeholder="e.g. A1"
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Bedrooms</span>
          <input
            name="bedrooms"
            type="number"
            min={0}
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Monthly rent (KES)</span>
          <input
            name="rentAmountKes"
            type="number"
            min={0}
            step="0.01"
            required
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>

        <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
          {pending ? "Saving…" : "Save unit"}
        </button>
      </form>
    </div>
  );
}
