import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth/session";
import { computeMriTax } from "@/lib/compliance/mri-tax";
import { db } from "@/db";
import { orgs, properties } from "@/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

/** Last N calendar months including the current one, newest first. */
function lastMonths(n: number): { year: number; month: number }[] {
  const now = new Date();
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

export default async function MriReportPage() {
  const { orgId } = await requireOrgMembership();

  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId));

  const [propertiesWithLr, totalProperties] = await Promise.all([
    db.$count(
      properties,
      and(eq(properties.orgId, orgId), isNull(properties.archivedAt), isNotNull(properties.lrNumber))
    ),
    db.$count(properties, and(eq(properties.orgId, orgId), isNull(properties.archivedAt))),
  ]);

  const months = lastMonths(6);
  const rows = await Promise.all(months.map((m) => computeMriTax(orgId, m.year, m.month)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MRI Tax</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Monthly Rental Income tax, computed from your ledger — not tax advice, confirm
            current KRA rates before filing.
          </p>
        </div>
        <a href="/api/reports/mri/csv" className="btn-secondary px-4 py-2 text-[13px]">
          Download CSV
        </a>
      </div>

      {!org?.kraPin && (
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-4 text-[12.5px]">
          <span className="text-[var(--color-warn)] font-medium">No KRA PIN on file.</span>{" "}
          Add your organization&apos;s KRA PIN in{" "}
          <Link href="/settings/org" className="text-[var(--color-accent-700)] font-medium">
            Settings → Organization
          </Link>{" "}
          — required on receipts and this export.
        </div>
      )}

      {propertiesWithLr < totalProperties && (
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-4 text-[12.5px]">
          <span className="text-[var(--color-warn)] font-medium">
            {propertiesWithLr} of {totalProperties} properties
          </span>{" "}
          have an LR (Land Reference) number on file — needed for eRITS property
          registration. Property-level editing lands in a later story.
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="text-[var(--color-ink-400)] text-[11px] uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">Period</th>
              <th className="px-3 py-3 font-medium text-right">Gross rent collected</th>
              <th className="px-3 py-3 font-medium text-right">Rate</th>
              <th className="px-5 py-3 font-medium text-right">Tax due</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
            {rows.map((r) => (
              <tr key={r.periodLabel}>
                <td className="px-5 py-3 font-medium tnum">{r.periodLabel}</td>
                <td className="px-3 py-3 text-right tnum">
                  KES {(r.grossRentCollectedCents / 100).toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right tnum">{r.ratePct}%</td>
                <td className="px-5 py-3 text-right font-medium tnum">
                  KES {(r.taxDueCents / 100).toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right">
                  {r.belowThreshold ? (
                    <Badge tone="neutral">below threshold</Badge>
                  ) : (
                    <Badge tone="warn">verify before filing</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
