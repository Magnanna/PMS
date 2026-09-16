"use client";

import { useState, useTransition } from "react";
import { inviteTenantToPortal } from "@/app/(app)/tenants/actions";

export function InviteTenantButton({ tenantProfileId }: { tenantProfileId: string }) {
  const [result, setResult] = useState<{ error: string | null; smsSent?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.smsSent) {
    return <span className="text-[11px] text-[var(--color-good)]">Invite sent</span>;
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary px-2.5 py-1 text-[11.5px]"
        onClick={() => {
          startTransition(async () => {
            const r = await inviteTenantToPortal(tenantProfileId);
            setResult(r);
          });
        }}
      >
        {pending ? "…" : "Invite to portal"}
      </button>
      {result?.error && (
        <p className="text-[10.5px] text-[var(--color-bad)] mt-1 max-w-[160px]">{result.error}</p>
      )}
    </div>
  );
}
