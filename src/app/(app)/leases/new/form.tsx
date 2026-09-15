"use client";

import { useActionState, useState } from "react";
import { createLease, type FormState } from "../actions";

const initialState: FormState = { error: null };

type VacantUnit = {
  id: string;
  unitNumber: string;
  rentAmountCents: number;
  propertyName: string;
};

export function NewLeaseForm({
  vacantUnits,
  tenants,
}: {
  vacantUnits: VacantUnit[];
  tenants: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createLease, initialState);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(vacantUnits[0]?.id ?? "");
  const selectedUnit = vacantUnits.find((u) => u.id === selectedUnitId);

  if (vacantUnits.length === 0) {
    return (
      <div className="card p-8 max-w-md w-full text-center text-[var(--color-ink-600)]">
        No vacant units available. Add a unit first.
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="card p-8 max-w-md w-full text-center text-[var(--color-ink-600)]">
        No tenants yet. Add a tenant first.
      </div>
    );
  }

  return (
    <form action={formAction} className="card p-8 max-w-md w-full space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">New lease</h1>

      {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Unit</span>
        <select
          name="unitId"
          required
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          className="hairline w-full rounded-md px-3 py-2"
        >
          {vacantUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.propertyName} / {u.unitNumber} — KES {(u.rentAmountCents / 100).toLocaleString()}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Tenant</span>
        <select name="tenantProfileId" required className="hairline w-full rounded-md px-3 py-2">
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Start date</span>
          <input
            name="startDate"
            type="date"
            required
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">
            End date <span className="text-[var(--color-ink-400)]">(optional)</span>
          </span>
          <input name="endDate" type="date" className="hairline w-full rounded-md px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Rent (KES)</span>
          <input
            name="rentAmountKes"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={selectedUnit ? selectedUnit.rentAmountCents / 100 : undefined}
            key={selectedUnitId}
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Deposit (KES)</span>
          <input
            name="depositAmountKes"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            className="hairline w-full rounded-md px-3 py-2"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Billing day of month (1–28)</span>
        <input
          name="billingDay"
          type="number"
          min={1}
          max={28}
          required
          defaultValue={1}
          className="hairline w-full rounded-md px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">
            Guarantor <span className="text-[var(--color-ink-400)]">(optional)</span>
          </span>
          <input name="guarantorName" className="hairline w-full rounded-md px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Guarantor phone</span>
          <input name="guarantorPhone" className="hairline w-full rounded-md px-3 py-2" />
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
        {pending ? "Saving…" : "Create lease"}
      </button>
    </form>
  );
}
