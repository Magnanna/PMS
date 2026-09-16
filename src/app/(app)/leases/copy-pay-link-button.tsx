"use client";

import { useState, useTransition } from "react";
import { getPayLinkForLease } from "./pay-actions";

export function CopyPayLinkButton({ leaseId }: { leaseId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary px-3 py-1.5 text-sm"
        onClick={() => {
          setError(null);
          setCopied(false);
          startTransition(async () => {
            const result = await getPayLinkForLease(leaseId);
            if (result.error || !result.url) {
              setError(result.error ?? "Could not create link");
              return;
            }
            try {
              await navigator.clipboard.writeText(result.url);
              setCopied(true);
            } catch {
              setError("Could not copy — link generated but clipboard access failed");
            }
          });
        }}
      >
        {pending ? "…" : copied ? "Copied!" : "Copy pay link"}
      </button>
      {error && <p className="text-xs text-[var(--color-bad)] mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
