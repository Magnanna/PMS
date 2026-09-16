"use client";

import { useRef, useState, useTransition } from "react";
import { previewImport, commitImport, type ImportPreview, type ImportCommitResult } from "./actions";

export function ImportClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      setResult(null);
      startTransition(async () => {
        const p = await previewImport(text);
        setPreview(p);
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-6 space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hairline w-full rounded-md px-3 py-2 text-sm"
        />
        {pending && <p className="text-[12.5px] text-[var(--color-ink-400)]">Validating…</p>}
      </div>

      {preview && !result && (
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-6 space-y-3">
          <p className="text-sm">
            <span className="font-medium">{preview.validCount}</span> valid row
            {preview.validCount === 1 ? "" : "s"} ·{" "}
            <span className="font-medium" style={{ color: preview.errors.length > 0 ? "var(--color-bad)" : undefined }}>
              {preview.errors.length}
            </span>{" "}
            error{preview.errors.length === 1 ? "" : "s"}
          </p>

          {preview.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {preview.errors.map((e, i) => (
                <p key={i} className="text-[11.5px] text-[var(--color-bad)]">
                  Row {e.rowIndex}: {e.message}
                </p>
              ))}
            </div>
          )}

          {preview.validCount > 0 && (
            <button
              type="button"
              disabled={pending}
              className="btn-primary px-4 py-2 text-[13px]"
              onClick={() => {
                if (!csvText) return;
                startTransition(async () => {
                  const r = await commitImport(csvText);
                  setResult(r);
                });
              }}
            >
              {pending ? "Importing…" : `Import ${preview.validCount} row${preview.validCount === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-6 space-y-1.5 text-sm">
          <p>✅ {result.propertiesCreated} properties created</p>
          <p>✅ {result.unitsCreated} units created</p>
          <p>✅ {result.tenantsCreated} tenants created</p>
          <p>✅ {result.leasesCreated} leases created</p>
          {result.leasesSkipped > 0 && (
            <p className="text-[var(--color-ink-400)]">
              ⏭ {result.leasesSkipped} skipped (unit already had an active lease)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
