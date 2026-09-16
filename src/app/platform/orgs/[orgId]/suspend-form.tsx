"use client";

import { useState, useTransition } from "react";
import { suspendOrg, unsuspendOrg } from "./actions";

export function SuspendForm({ orgId, suspended }: { orgId: string; suspended: boolean }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (suspended) {
    return (
      <button
        type="button"
        disabled={pending}
        className="btn-secondary px-4 py-2 text-[13px]"
        onClick={() => startTransition(async () => {
          await unsuspendOrg(orgId);
        })}
      >
        {pending ? "Reactivating…" : "Reactivate org"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for suspension"
        className="hairline w-full rounded-md px-3 py-2 text-sm"
        rows={2}
      />
      {error && <p className="text-[11.5px] text-[var(--color-bad)]">{error}</p>}
      <button
        type="button"
        disabled={pending}
        className="px-4 py-2 text-[13px] rounded-md bg-red-600 text-white disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            const result = await suspendOrg(orgId, reason);
            setError(result.error);
          })
        }
      >
        {pending ? "Suspending…" : "Suspend org"}
      </button>
    </div>
  );
}
