"use client";

import { useActionState } from "react";
import { createUnit, type FormState } from "../actions";

const initialState: FormState = { error: null };

export function NewUnitForm({
  propertyId,
  propertyType,
}: {
  propertyId: string;
  propertyType: "residential" | "commercial" | "mixed";
}) {
  const boundCreateUnit = createUnit.bind(null, propertyId);
  const [state, formAction, pending] = useActionState(boundCreateUnit, initialState);

  const showResidential = propertyType === "residential" || propertyType === "mixed";
  const showCommercial = propertyType === "commercial" || propertyType === "mixed";

  return (
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

      {showResidential && (
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Bedrooms</span>
          <input
            name="bedrooms"
            type="number"
            min={0}
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>
      )}

      {showCommercial && (
        <>
          <label className="block space-y-1">
            <span className="text-sm text-[var(--color-ink-600)]">Unit type</span>
            <select
              name="commercialUnitType"
              className="hairline w-full rounded-md px-3 py-2"
              defaultValue="office"
            >
              <option value="office">Office</option>
              <option value="shop">Shop</option>
              <option value="warehouse">Warehouse</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-[var(--color-ink-600)]">Floor area (sq ft)</span>
            <input
              name="floorAreaSqft"
              type="number"
              min={0}
              className="hairline w-full rounded-md px-3 py-2"
            />
          </label>
        </>
      )}

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
  );
}
