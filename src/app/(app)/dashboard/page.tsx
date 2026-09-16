import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth/session";
import { db } from "@/db";
import { properties, units, leases, payments } from "@/db/schema";
import { eq, and, isNull, gte } from "drizzle-orm";
import { StatCard } from "@/components/StatCard";
import { GenerateInvoicesButton } from "./generate-invoices-button";
import { computeMriTax } from "@/lib/compliance/mri-tax";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { orgId } = await requireOrgMembership();

  const now = new Date();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [propertyCount, unitRows, activeLeaseCount, confirmedPaymentsThisMonth, mriTax] =
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
      computeMriTax(orgId, now.getUTCFullYear(), now.getUTCMonth() + 1),
    ]);

  const vacantCount = unitRows.filter((u) => u.status === "vacant").length;
  const rentCollectedCents = confirmedPaymentsThisMonth.reduce(
    (sum, p) => sum + p.amountCents,
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Home</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Rent collection and portfolio status.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11.5px] text-[var(--color-ink-400)] pb-1">
            {new Date().toLocaleDateString("en-KE", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <GenerateInvoicesButton />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Rent collected this month"
          value={`KES ${(rentCollectedCents / 100).toLocaleString()}`}
        />
        <StatCard label="Properties" value={String(propertyCount)} />
        <StatCard
          label="Vacant units"
          value={`${vacantCount} / ${unitRows.length}`}
          sub={vacantCount > 0 ? `${vacantCount} unit${vacantCount === 1 ? "" : "s"} to fill` : "fully occupied"}
          subTone={vacantCount > 0 ? "muted" : "good"}
        />
        <StatCard label="Active leases" value={String(activeLeaseCount)} />
      </div>

      <Link href="/reports/mri" className="block">
        <StatCard
          label={`MRI tax due (${mriTax.periodLabel}, ${mriTax.ratePct}%)`}
          value={`KES ${(mriTax.taxDueCents / 100).toLocaleString()}`}
          sub={
            mriTax.belowThreshold
              ? "below entry threshold — verify before filing"
              : "due by the 20th of next month · view summary"
          }
          subTone={mriTax.belowThreshold ? "muted" : "bad"}
        />
      </Link>

      <p className="text-[11.5px] text-[var(--color-ink-400)]">
        Arrears aging lands in a later story. MRI tax is computed from your records under the
        rules configured in compliance/constants.ts — confirm current KRA rates before filing.
        Not tax advice.
      </p>
    </div>
  );
}
