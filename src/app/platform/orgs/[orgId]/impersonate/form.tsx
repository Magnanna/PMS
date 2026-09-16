"use client";

import { useState, useTransition } from "react";
import { startImpersonation } from "../actions";

export function ImpersonateForm({ orgId }: { orgId: string }) {
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5 space-y-3">
      <label className="block text-[12.5px] font-medium text-[var(--color-ink-600)]">
        Reason for this session
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. investigating unmatched payment ticket #123"
          className="hairline mt-1 w-full rounded-md px-3 py-2 text-sm font-normal"
          rows={3}
        />
      </label>
      <label className="flex items-start gap-2 text-[12.5px] text-[var(--color-ink-600)]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        This is a consented support session and I will use it only for the stated reason.
      </label>
      {error && <p className="text-[11.5px] text-[var(--color-bad)]">{error}</p>}
      <button
        type="button"
        disabled={pending}
        className="btn-primary px-4 py-2 text-[13px] disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            const result = await startImpersonation(orgId, reason, consent);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Starting…" : "Start session"}
      </button>
    </div>
  );
}
