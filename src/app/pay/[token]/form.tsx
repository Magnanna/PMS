"use client";

import { useActionState } from "react";
import { initiatePublicStkPush, type PayActionState } from "./actions";

const initialState: PayActionState = { error: null };

export function PayForm({ token, defaultPhone }: { token: string; defaultPhone: string }) {
  const boundAction = initiatePublicStkPush.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (state.sent) {
    return (
      <div className="text-center space-y-2 py-2">
        <div className="text-lg">📲</div>
        <p className="text-sm text-[var(--color-ink-600)]">
          Check your phone — enter your M-Pesa PIN to complete payment.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}

      <label className="block space-y-1">
        <span className="text-sm text-[var(--color-ink-600)]">M-Pesa phone number</span>
        <input
          name="phone"
          defaultValue={defaultPhone.replace(/^254/, "0")}
          required
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
      </label>

      <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
        {pending ? "Sending…" : "Pay with M-Pesa"}
      </button>
    </form>
  );
}
