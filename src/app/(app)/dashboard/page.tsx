import { requireOrgMembership } from "@/lib/auth/session";
import { db } from "@/db";
import { properties, units, leases } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export default async function DashboardPage() {
  const { orgId } = await requireOrgMembership();

  const [propertyCount, unitRows, activeLeaseCount] = await Promise.all([
    db.$count(properties, and(eq(properties.orgId, orgId), isNull(properties.archivedAt))),
    db
      .select({ status: units.status })
      .from(units)
      .where(and(eq(units.orgId, orgId), isNull(units.archivedAt))),
    db.$count(leases, and(eq(leases.orgId, orgId), eq(leases.status, "active"))),
  ]);

  const vacantCount = unitRows.filter((u) => u.status === "vacant").length;

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Home</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        Rent collection, arrears, and MRI tax figures land in M2/M3 — this is the M1
        structural view (properties/units/leases only, no payments yet).
      </p>
    </main>
  );
}
