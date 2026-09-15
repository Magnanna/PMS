"use client";

import { useState, useTransition } from "react";
import { archiveUnit } from "./actions";

export function UnitArchiveButton({
  propertyId,
  unitId,
}: {
  propertyId: string;
  unitId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary px-3 py-1.5 text-sm"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await archiveUnit(propertyId, unitId);
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
      {error && <p className="text-xs text-[var(--color-bad)] mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
