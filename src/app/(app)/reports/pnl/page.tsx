import { requireOrgMembership } from "@/lib/auth/session";
import { computePnl } from "@/lib/reports/pnl";
import { StatCard } from "@/components/StatCard";

export const dynamic = "force-dynamic";

const ACCOUNT_LABEL: Record<string, string> = {
  rental_income: "Rental income",
  pass_through_income: "Utilities / service charges",
  late_fee_income: "Late fees",
  maintenance_expense: "Maintenance",
};

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { orgId } = await requireOrgMembership();
  const { month: monthParam } = await searchParams;

  const now = new Date();
  const [year, month] = (monthParam ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const pnl = await computePnl(orgId, startDate, endDate);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profit &amp; Loss</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            {startDate.toLocaleDateString("en-KE", { month: "long", year: "numeric" })} · read
            from the ledger, not invoices
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={`${year}-${String(month).padStart(2, "0")}`}
            className="hairline rounded-md px-3 py-1.5 text-[13px]"
          />
          <button type="submit" className="btn-secondary px-3 py-1.5 text-[13px]">
            Go
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Income" value={`KES ${(pnl.totalIncomeCents / 100).toLocaleString()}`} />
        <StatCard
          label="Expenses"
          value={`KES ${(pnl.totalExpenseCents / 100).toLocaleString()}`}
        />
        <StatCard
          label="Net"
          value={`KES ${(pnl.netCents / 100).toLocaleString()}`}
          subTone={pnl.netCents >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <table className="w-full text-left text-[12.5px]">
          <tbody className="divide-y divide-[var(--color-ink-100)]">
            {pnl.byAccount.map((row) => (
              <tr key={row.account}>
                <td className="px-5 py-3">{ACCOUNT_LABEL[row.account] ?? row.account}</td>
                <td className="px-5 py-3 text-right tnum">
                  KES {(row.amountCents / 100).toLocaleString()}
                </td>
              </tr>
            ))}
            {pnl.vacancyLossCents > 0 && (
              <tr>
                <td className="px-5 py-3 text-[var(--color-ink-400)]">
                  Vacancy loss (expected rent, unoccupied units)
                </td>
                <td className="px-5 py-3 text-right tnum text-[var(--color-ink-400)]">
                  KES {(pnl.vacancyLossCents / 100).toLocaleString()}
                </td>
              </tr>
            )}
            {pnl.byAccount.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                  No activity this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
