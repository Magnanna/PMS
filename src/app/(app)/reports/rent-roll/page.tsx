import { requireOrgMembership } from "@/lib/auth/session";
import { computeRentRoll } from "@/lib/reports/rent-roll";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function RentRollPage() {
  const { orgId } = await requireOrgMembership();
  const rows = await computeRentRoll(orgId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rent Roll</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Every active lease, current rent, and arrears.
          </p>
        </div>
        <a href="/api/reports/rent-roll/csv" className="btn-secondary px-4 py-2 text-[13px]">
          Download CSV
        </a>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
            No active leases.
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="text-[var(--color-ink-400)] text-[11px] uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-3 py-3 font-medium">Tenant</th>
                <th className="px-3 py-3 font-medium text-right">Rent</th>
                <th className="px-3 py-3 font-medium text-right">Arrears</th>
                <th className="px-5 py-3 font-medium">Lease end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 font-medium">
                    {r.propertyName} / {r.unitNumber}
                    {r.controlledTenancy && (
                      <Badge tone="warn">
                        <span className="ml-1">controlled</span>
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">{r.tenantName}</td>
                  <td className="px-3 py-3 text-right tnum">
                    KES {(r.rentAmountCents / 100).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tnum">
                    {r.arrearsCents > 0 ? (
                      <span style={{ color: "var(--color-bad)" }}>
                        KES {(r.arrearsCents / 100).toLocaleString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-ink-400)]">
                    {r.leaseEndDate ?? "month-to-month"}
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
