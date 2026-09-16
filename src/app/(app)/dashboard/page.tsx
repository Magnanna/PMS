import { requireOrgMembership } from "@/lib/auth/session";
import { db } from "@/db";
import { properties, units, leases, payments } from "@/db/schema";
import { eq, and, isNull, gte } from "drizzle-orm";
import { GenerateInvoicesButton } from "./generate-invoices-button";

export default async function DashboardPage() {
  const { orgId } = await requireOrgMembership();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [propertyCount, unitRows, activeLeaseCount, confirmedPaymentsThisMonth] =
    await Promise.all([
      db.$count(properties, and(eq(properties.orgId, orgId), isNull(properties.archivedAt))),
      db
        .select({ status: units.status })
        .from(units)
        .where(and(eq(units.orgId, orgId), isNull(units.archivedAt))),
      db.$count(leases, and(eq(leases.orgId, orgId), eq(leases.status, "active"))),
      db
        .select({ amountCents: payments.amountCents })
        .from(payments)
        .where(
          and(
            eq(payments.orgId, orgId),
            eq(payments.status, "confirmed"),
            gte(payments.paidAt, monthStart)
          )
        ),
    ]);

  const vacantCount = unitRows.filter((u) => u.status === "vacant").length;
  const rentCollectedCents = confirmedPaymentsThisMonth.reduce(
    (sum, p) => sum + p.amountCents,
    0
  );

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <GenerateInvoicesButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-sm text-[var(--color-ink-600)]">Rent collected this month</div>
          <div className="money-lg stat-figure tnum">
            KES {(rentCollectedCents / 100).toLocaleString()}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-[var(--color-ink-600)]">Properties</div>
          <div className="money-lg stat-figure">{propertyCount}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-[var(--color-ink-600)]">Vacant units</div>
          <div className="money-lg stat-figure">
            {vacantCount} / {unitRows.length}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-[var(--color-ink-600)]">Active leases</div>
          <div className="money-lg stat-figure">{activeLeaseCount}</div>
        </div>
      </div>

      <p className="text-sm text-[var(--color-ink-400)]">
        Arrears aging and MRI tax figures land in later stories — this dashboard covers
        what M1/M2 have shipped so far (structure + M-Pesa collection).
      </p>
    </main>
  );
}
