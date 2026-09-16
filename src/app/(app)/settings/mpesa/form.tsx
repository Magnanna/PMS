"use client";

import { useActionState, useState, useTransition } from "react";
import { saveMpesaCredentials, testMpesaCredentials, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function MpesaSettingsForm() {
  const [state, formAction, pending] = useActionState(saveMpesaCredentials, initialState);
  const [testResult, setTestResult] = useState<{ error: string | null } | null>(null);
  const [testing, startTest] = useTransition();

  return (
    <div className="card p-6 space-y-4">
      <form action={formAction} className="space-y-4">
        {state.error && <p className="text-sm text-[var(--color-bad)]">{state.error}</p>}
        {state.success && (
          <p className="text-sm" style={{ color: "var(--color-good)" }}>
            Saved.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Shortcode type</span>
          <select name="shortcodeType" className="hairline w-full rounded-md px-3 py-2 text-sm">
            <option value="paybill">Paybill</option>
            <option value="till">Till (Buy Goods)</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Shortcode</span>
          <input name="shortcode" required className="hairline w-full rounded-md px-3 py-2 text-sm" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Consumer key</span>
          <input
            name="consumerKey"
            required
            autoComplete="off"
            className="hairline w-full rounded-md px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Consumer secret</span>
          <input
            name="consumerSecret"
            type="password"
            required
            autoComplete="off"
            className="hairline w-full rounded-md px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">
            Passkey <span className="text-[var(--color-ink-400)]">(needed for STK push)</span>
          </span>
          <input
            name="passkey"
            type="password"
            autoComplete="off"
            className="hairline w-full rounded-md px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-ink-600)]">Environment</span>
          <select name="environment" className="hairline w-full rounded-md px-3 py-2 text-sm">
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
        </label>

        <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
          {pending ? "Saving…" : "Save credentials"}
        </button>
      </form>

      <button
        type="button"
        disabled={testing}
        className="btn-secondary w-full px-4 py-2"
        onClick={() => {
          setTestResult(null);
          startTest(async () => {
            const result = await testMpesaCredentials();
            setTestResult(result);
          });
        }}
      >
        {testing ? "Testing…" : "Test connection"}
      </button>

      {testResult && (
        <p
          className="text-sm"
          style={{ color: testResult.error ? "var(--color-bad)" : "var(--color-good)" }}
        >
          {testResult.error ?? "Connection OK — access token retrieved."}
        </p>
      )}
    </div>
  );
}
