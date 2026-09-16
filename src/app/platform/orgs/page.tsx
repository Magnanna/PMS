import Link from "next/link";
import { listOrgsWithUsage } from "@/lib/platform/usage";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";

function fmtKes(cents: number): string {
  return `KES ${(cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export default async function PlatformOrgsPage() {
  const orgsList = await listOrgsWithUsage();
  const suspendedCount = orgsList.filter((o) => o.suspended).length;
  const totalVolume = orgsList.reduce((sum, o) => sum + o.paymentVolumeCentsThisMonth, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total orgs" value={String(orgsList.length)} />
        <StatCard
          label="Suspended"
          value={String(suspendedCount)}
          sub={suspendedCount > 0 ? "needs attention" : undefined}
          subTone={suspendedCount > 0 ? "bad" : undefined}
        />
        <StatCard label="Payment volume (this month)" value={fmtKes(totalVolume)} />
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11.5px] text-[var(--color-ink-400)] border-b border-[var(--color-ink-100)]">
              <th className="text-left font-medium px-4 py-2.5">Org</th>
              <th className="text-left font-medium px-4 py-2.5">Plan</th>
              <th className="text-right font-medium px-4 py-2.5">Units</th>
              <th className="text-right font-medium px-4 py-2.5">SMS (month)</th>
              <th className="text-right font-medium px-4 py-2.5">Volume (month)</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {orgsList.map((org) => (
              <tr key={org.id} className="border-b border-[var(--color-ink-100)] last:border-0">
                <td className="px-4 py-2.5 font-medium">{org.name}</td>
                <td className="px-4 py-2.5 capitalize">{org.plan}</td>
                <td className="px-4 py-2.5 text-right tnum">{org.unitCount}</td>
                <td className="px-4 py-2.5 text-right tnum">{org.smsUnitsThisMonth}</td>
                <td className="px-4 py-2.5 text-right tnum">{fmtKes(org.paymentVolumeCentsThisMonth)}</td>
                <td className="px-4 py-2.5">
                  {org.suspended ? <Badge tone="bad">Suspended</Badge> : <Badge tone="good">Active</Badge>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/platform/orgs/${org.id}`} className="text-[12.5px] text-[var(--color-accent-700)]">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {orgsList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-ink-400)] text-sm">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
