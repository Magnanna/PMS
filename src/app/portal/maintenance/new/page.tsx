import { requireTenantProfiles } from "@/lib/auth/session";
import { db } from "@/db";
import { leases, units, properties } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NewTicketForm } from "./form";

export default async function NewMaintenanceTicketPage() {
  const { profiles } = await requireTenantProfiles();

  const activeLeases = await db
    .select({
      leaseId: leases.id,
      unitNumber: units.unitNumber,
      propertyName: properties.name,
    })
    .from(leases)
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .where(
      and(
        inArray(
          leases.tenantProfileId,
          profiles.map((p) => p.id)
        ),
        eq(leases.status, "active")
      )
    );

  if (activeLeases.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--color-ink-600)]">
        No active lease to report an issue for.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Report an issue</h1>
      <NewTicketForm leases={activeLeases} />
    </div>
  );
}
