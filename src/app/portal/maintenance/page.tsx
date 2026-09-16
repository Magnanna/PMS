import Link from "next/link";
import { requireTenantProfiles } from "@/lib/auth/session";
import { db } from "@/db";
import { maintenanceTickets, leases, units, properties } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { Badge, type BadgeTone } from "@/components/Badge";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  open: "warn",
  assigned: "info",
  in_progress: "info",
  resolved: "good",
  closed: "neutral",
};

export default async function PortalMaintenancePage() {
  const { profiles } = await requireTenantProfiles();

  const myLeases = await db
    .select({ id: leases.id })
    .from(leases)
    .where(
      inArray(
        leases.tenantProfileId,
        profiles.map((p) => p.id)
      )
    );

  const rows =
    myLeases.length === 0
      ? []
      : await db
          .select({
            ticket: maintenanceTickets,
            unitNumber: units.unitNumber,
            propertyName: properties.name,
          })
          .from(maintenanceTickets)
          .innerJoin(units, eq(maintenanceTickets.unitId, units.id))
          .innerJoin(properties, eq(units.propertyId, properties.id))
          .where(
            inArray(
              maintenanceTickets.leaseId,
              myLeases.map((l) => l.id)
            )
          )
          .orderBy(desc(maintenanceTickets.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Maintenance</h1>
        <Link href="/portal/maintenance/new" className="btn-primary px-3 py-1.5 text-[13px]">
          + Report issue
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[var(--color-ink-600)]">
          No requests yet.
        </div>
      ) : (
        <div className="card divide-y divide-[var(--color-ink-100)]">
          {rows.map(({ ticket, unitNumber, propertyName }) => (
            <div key={ticket.id} className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{ticket.category}</span>
                <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-xs text-[var(--color-ink-600)]">{ticket.description}</p>
              <p className="text-[11px] text-[var(--color-ink-400)]">
                {propertyName} / {unitNumber} ·{" "}
                {new Date(ticket.createdAt).toLocaleDateString("en-KE", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
