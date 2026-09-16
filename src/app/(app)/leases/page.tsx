import Link from "next/link";
import { db } from "@/db";
import { leases, units, tenantProfiles, properties, invoices } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireOrgMembership } from "@/lib/auth/session";
import { TerminateButton } from "./lease-actions";
import { ChargeMpesaButton } from "./charge-mpesa-button";
import { invoiceBalanceCents } from "@/lib/payments/allocate";

export default async function LeasesPage() {
  const { orgId } = await requireOrgMembership();

  const rows = await db
    .select({
      lease: leases,
      unitNumber: units.unitNumber,
      propertyName: properties.name,
      tenantName: tenantProfiles.name,
    })
    .from(leases)
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .innerJoin(tenantProfiles, eq(leases.tenantProfileId, tenantProfiles.id))
    .where(eq(leases.orgId, orgId));

  const balances = new Map<string, number>();
  for (const { lease } of rows) {
    if (lease.status !== "active") continue;
    const openInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(eq(invoices.leaseId, lease.id), inArray(invoices.status, ["open", "partially_paid"]))
      );
    let total = 0;
    for (const inv of openInvoices) total += await invoiceBalanceCents(inv.id);
    balances.set(lease.id, total);
  }

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Leases</h1>
        <Link href="/leases/new" className="btn-primary px-4 py-2">
          + New lease
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-[var(--color-ink-600)]">
          No leases yet.{" "}
          <Link href="/leases/new" className="text-[var(--color-accent-500)]">
            Create your first lease
          </Link>
          .
        </div>
      ) : (
        <div className="card divide-y divide-[var(--color-ink-100)]">
          {rows.map(({ lease, unitNumber, propertyName, tenantName }) => {
            const balanceCents = balances.get(lease.id) ?? 0;
            return (
              <div key={lease.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">
                    {tenantName} · {propertyName} / {unitNumber}
                    {lease.controlledTenancy && (
                      <span className="ml-2 text-xs text-[var(--color-warn)]">
                        controlled tenancy
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[var(--color-ink-600)] tnum">
                    KES {(lease.rentAmountCents / 100).toLocaleString()}/mo · billing day{" "}
                    {lease.billingDay} · <span className="capitalize">{lease.status}</span>
                    {lease.status === "active" && balanceCents > 0 && (
                      <span className="ml-2" style={{ color: "var(--color-bad)" }}>
                        KES {(balanceCents / 100).toLocaleString()} due
                      </span>
                    )}
                  </div>
                </div>
                {lease.status === "active" && (
                  <div className="flex items-center gap-2">
                    {balanceCents > 0 && <ChargeMpesaButton leaseId={lease.id} />}
                    <TerminateButton leaseId={lease.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
