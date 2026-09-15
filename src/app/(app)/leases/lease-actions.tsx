"use client";

import { useState, useTransition } from "react";
import { terminateLease } from "./actions";

export function TerminateButton({ leaseId }: { leaseId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setOpen(true)}>
        Terminate
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        className="hairline rounded-md px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={pending}
        className="btn-primary px-3 py-1.5 text-sm"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await terminateLease(leaseId, reason);
            if (result.error) setError(result.error);
            else setOpen(false);
          });
        }}
      >
        {pending ? "…" : "Confirm"}
      </button>
      {error && <p className="text-xs text-[var(--color-bad)]">{error}</p>}
    </div>
  );
}
