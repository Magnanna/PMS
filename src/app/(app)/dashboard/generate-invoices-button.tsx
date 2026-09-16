"use client";

import { useState, useTransition } from "react";
import { generateInvoicesNow } from "../billing/actions";

export function GenerateInvoicesButton() {
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-sm text-[var(--color-ink-600)] tnum">
          {result.created} created, {result.skipped} already existed
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        className="btn-secondary px-4 py-2"
        onClick={() => {
          startTransition(async () => {
            const r = await generateInvoicesNow();
            setResult(r);
          });
        }}
      >
        {pending ? "Generating…" : "Generate this month's invoices"}
      </button>
    </div>
  );
}
