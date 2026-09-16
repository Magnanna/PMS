"use client";

import { useState, useTransition } from "react";
import { chargeRentViaMpesa } from "./pay-actions";

export function ChargeMpesaButton({ leaseId }: { leaseId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return <span className="text-sm text-[var(--color-ink-600)]">STK sent — awaiting confirmation</span>;
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className="btn-primary px-3 py-1.5 text-sm"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await chargeRentViaMpesa(leaseId);
            if (result.error) setError(result.error);
            else setSent(true);
          });
        }}
      >
        {pending ? "Sending…" : "Charge M-Pesa"}
      </button>
      {error && <p className="text-xs text-[var(--color-bad)] mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
