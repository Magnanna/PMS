"use client";

import { useActionState } from "react";
import { createMaintenanceTicket, type FormState } from "./actions";

const initialState: FormState = { error: null };

const CATEGORIES = ["Plumbing", "Electrical", "Structural", "Appliance", "Pest control", "Other"];

export function NewTicketForm({
  leases,
}: {
  leases: { leaseId: string; unitNumber: string; propertyName: string }[];
}) {
  const [state, formAction, pending] = useActionState(createMaintenanceTicket, initialState);

  return (
    <form action={formAction} className="card p-6 space-y-4">
      {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}

      {leases.length > 1 && (
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Unit</span>
          <select name="leaseId" required className="hairline w-full rounded-md px-3 py-2 text-sm">
            {leases.map((l) => (
              <option key={l.leaseId} value={l.leaseId}>
                {l.propertyName} / {l.unitNumber}
              </option>
            ))}
          </select>
        </label>
      )}
      {leases.length === 1 && <input type="hidden" name="leaseId" value={leases[0].leaseId} />}

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Category</span>
        <select name="category" required className="hairline w-full rounded-md px-3 py-2 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Describe the issue</span>
        <textarea
          name="description"
          required
          rows={4}
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">
          Photos <span className="text-[var(--color-ink-400)]">(up to 5, optional)</span>
        </span>
        <input
          name="photos"
          type="file"
          accept="image/*"
          multiple
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
      </label>

      <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
