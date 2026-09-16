"use client";

import { useActionState } from "react";
import { updateOrgDetails, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function OrgSettingsForm({
  defaultKraPin,
  defaultRegisteredAddress,
  defaultContactPerson,
}: {
  defaultKraPin: string;
  defaultRegisteredAddress: string;
  defaultContactPerson: string;
}) {
  const [state, formAction, pending] = useActionState(updateOrgDetails, initialState);

  return (
    <form
      action={formAction}
      className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-6 space-y-4"
    >
      {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}
      {state.success && (
        <p className="text-sm" style={{ color: "var(--color-good)" }}>
          Saved.
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">KRA PIN</span>
        <input
          name="kraPin"
          defaultValue={defaultKraPin}
          placeholder="P051234567X"
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Registered address</span>
        <input
          name="registeredAddress"
          defaultValue={defaultRegisteredAddress}
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">Contact person</span>
        <input
          name="contactPerson"
          defaultValue={defaultContactPerson}
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
      </label>

      <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2 text-[13px]">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
