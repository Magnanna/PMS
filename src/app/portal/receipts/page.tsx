import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantProfiles } from "@/lib/auth/session";
import { db } from "@/db";
import { receipts, payments, leases } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** US-H2: past receipts for one of the signed-in tenant's leases. */
export default async function PortalReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantProfileId } = await searchParams;
  const { profiles } = await requireTenantProfiles();

  const profile = profiles.find((p) => p.id === tenantProfileId);
  if (!profile) notFound();

  const rows = await db
    .select({ receipt: receipts, payment: payments })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .innerJoin(leases, eq(payments.leaseId, leases.id))
    .where(and(eq(leases.tenantProfileId, profile.id), eq(payments.status, "confirmed")))
    .orderBy(desc(payments.paidAt));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Receipts</h1>
        <Link href="/portal" className="text-[12.5px] text-[var(--color-accent-700)]">
          ← Back
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[var(--color-ink-600)]">
          No payments yet.
        </div>
      ) : (
        <div className="card divide-y divide-[var(--color-ink-100)]">
          {rows.map(({ receipt, payment }) => (
            <Link
              key={receipt.id}
              href={`/r/${receipt.token}`}
              className="flex items-center justify-between p-4 hover:bg-[var(--color-ink-50)]"
            >
              <div>
                <div className="text-sm font-medium tnum">
                  KES {(payment.amountCents / 100).toLocaleString()}
                </div>
                <div className="text-xs text-[var(--color-ink-400)] tnum">
                  {new Date(payment.paidAt).toLocaleDateString("en-KE", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <span className="text-[var(--color-accent-700)] text-sm">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
