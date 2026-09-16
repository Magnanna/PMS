import { ImportClient } from "./client";

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Bring in properties, units, tenants, and leases from a spreadsheet.
          </p>
        </div>
        <a href="/api/import/template" className="btn-secondary px-4 py-2 text-[13px]">
          Download template
        </a>
      </div>

      <ImportClient />
    </div>
  );
}
