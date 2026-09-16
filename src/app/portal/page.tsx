import Link from "next/link";
import { requireTenantProfiles } from "@/lib/auth/session";
import { db } from "@/db";
import { leases, units, properties, orgs, invoices } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { invoiceBalanceCents } from "@/lib/payments/allocate";
import { Badge } from "@/components/Badge";
import { createStatementToken } from "@/lib/reports/statement-link";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const { profiles } = await requireTenantProfiles();

  const leaseRows = await Promise.all(
    profiles.map(async (profile) => {
      const [row] = await db
        .select({
          lease: leases,
          unit: units,
          property: properties,
          org: orgs,
        })
        .from(leases)
        .innerJoin(units, eq(leases.unitId, units.id))
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .innerJoin(orgs, eq(leases.orgId, orgs.id))
        .where(and(eq(leases.tenantProfileId, profile.id), eq(leases.status, "active")));

      if (!row) return null;

      const openInvoices = await db
        .select({ id: invoices.id, billingPeriod: invoices.billingPeriod, dueDate: invoices.dueDate })
        .from(invoices)
        .where(
          and(
            eq(invoices.leaseId, row.lease.id),
            inArray(invoices.status, ["open", "partially_paid"])
          )
        );

      let balanceCents = 0;
      for (const inv of openInvoices) balanceCents += await invoiceBalanceCents(inv.id);

      return { profile, ...row, balanceCents };
    })
  );

  const active = leaseRows.filter((r): r is NonNullable<typeof r> => r !== null);

  if (active.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--color-ink-600)]">
        No active lease found on your account yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active.map(({ profile, lease, unit, property, org, balanceCents }) => (
        <div key={lease.id} className="card p-5 space-y-3">
          <div>
            <div className="text-[11px] text-[var(--color-ink-400)] uppercase tracking-wider">
              {org.name}
            </div>
            <div className="font-semibold text-lg">
              {property.name} / {unit.unitNumber}
            </div>
          </div>

          <div className="hairline-t hairline-b py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-ink-600)]">Monthly rent</span>
              <span className="tnum">KES {(lease.rentAmountCents / 100).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-ink-600)]">Billing day</span>
              <span className="tnum">{lease.billingDay}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-ink-600)]">Balance</span>
            {balanceCents > 0 ? (
              <span className="money-lg" style={{ color: "var(--color-bad)" }}>
                KES {(balanceCents / 100).toLocaleString()}
              </span>
            ) : (
              <Badge tone="good">Paid up</Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/portal/receipts?tenant=${profile.id}`}
              className="btn-secondary flex-1 text-center px-4 py-2 text-[13px]"
            >
              Receipts
            </Link>
            <Link
              href={`/statement/${createStatementToken(lease.id)}`}
              className="btn-secondary flex-1 text-center px-4 py-2 text-[13px]"
            >
              Statement
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
