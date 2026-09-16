import Link from "next/link";
import { db } from "@/db";
import { leases, units, tenantProfiles, properties, invoices } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireOrgMembership } from "@/lib/auth/session";
import { TerminateButton } from "./lease-actions";
import { ChargeMpesaButton } from "./charge-mpesa-button";
import { CopyPayLinkButton } from "./copy-pay-link-button";
import { invoiceBalanceCents } from "@/lib/payments/allocate";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

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

  const statusTone = { active: "good", terminated: "neutral", expired: "neutral" } as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leases</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Every tenant currently (or previously) under contract.
          </p>
        </div>
        <Link href="/leases/new" className="btn-primary px-4 py-2 text-[13px]">
          + New lease
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
            No leases yet.{" "}
            <Link href="/leases/new" className="text-[var(--color-accent-700)] font-medium">
              Create your first lease
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map(({ lease, unitNumber, propertyName, tenantName }) => {
                const balanceCents = balances.get(lease.id) ?? 0;
                return (
                  <tr key={lease.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium">
                        {tenantName} · {propertyName} / {unitNumber}
                      </div>
                      <div className="text-[11px] text-[var(--color-ink-400)] tnum mt-0.5">
                        KES {(lease.rentAmountCents / 100).toLocaleString()}/mo · billing day{" "}
                        {lease.billingDay}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge tone={statusTone[lease.status]}>{lease.status}</Badge>
                        {lease.controlledTenancy && <Badge tone="warn">controlled tenancy</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tnum">
                      {lease.status === "active" && balanceCents > 0 && (
                        <span className="text-[var(--color-bad)] font-medium">
                          KES {(balanceCents / 100).toLocaleString()} due
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {lease.status === "active" && (
                        <div className="flex items-center justify-end gap-2">
                          {balanceCents > 0 && <ChargeMpesaButton leaseId={lease.id} />}
                          {balanceCents > 0 && <CopyPayLinkButton leaseId={lease.id} />}
                          <TerminateButton leaseId={lease.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
