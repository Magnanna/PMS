import Link from "next/link";
import { listTenants } from "./actions";
import { InviteTenantButton } from "@/components/InviteTenantButton";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await listTenants();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Everyone you&apos;ve recorded, leased or not yet.
          </p>
        </div>
        <Link href="/tenants/new" className="btn-primary px-4 py-2 text-[13px]">
          + New tenant
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        {tenants.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
            No tenants yet.{" "}
            <Link href="/tenants/new" className="text-[var(--color-accent-700)] font-medium">
              Add your first tenant
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{t.name}</div>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-ink-400)] tnum">
                    +{t.phone} {t.email ? `· ${t.email}` : ""}
                  </td>
                  <td className="px-5 py-3">
                    {t.userId ? (
                      <Badge tone="good">Portal active</Badge>
                    ) : (
                      <InviteTenantButton tenantProfileId={t.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
