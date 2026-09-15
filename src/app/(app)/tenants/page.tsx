import Link from "next/link";
import { listTenants } from "./actions";

export default async function TenantsPage() {
  const tenants = await listTenants();

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <Link href="/tenants/new" className="btn-primary px-4 py-2">
          + New tenant
        </Link>
      </div>

      {tenants.length === 0 ? (
        <div className="card p-8 text-center text-[var(--color-ink-600)]">
          No tenants yet.{" "}
          <Link href="/tenants/new" className="text-[var(--color-accent-500)]">
            Add your first tenant
          </Link>
          .
        </div>
      ) : (
        <div className="card divide-y divide-[var(--color-ink-100)]">
          {tenants.map((t) => (
            <div key={t.id} className="p-4">
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-[var(--color-ink-600)] tnum">
                +{t.phone} {t.email ? `· ${t.email}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
