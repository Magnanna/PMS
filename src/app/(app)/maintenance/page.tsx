import { requireOrgMembership } from "@/lib/auth/session";
import { db } from "@/db";
import { maintenanceTickets, units, properties, vendors } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge, type BadgeTone } from "@/components/Badge";
import { TicketActions } from "./ticket-actions";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  open: "warn",
  assigned: "info",
  in_progress: "info",
  resolved: "good",
  closed: "neutral",
};

export default async function MaintenancePage() {
  const { orgId } = await requireOrgMembership();

  const rows = await db
    .select({
      ticket: maintenanceTickets,
      unitNumber: units.unitNumber,
      propertyName: properties.name,
      vendorName: vendors.name,
    })
    .from(maintenanceTickets)
    .innerJoin(units, eq(maintenanceTickets.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .leftJoin(vendors, eq(maintenanceTickets.vendorId, vendors.id))
    .where(eq(maintenanceTickets.orgId, orgId))
    .orderBy(desc(maintenanceTickets.createdAt));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">
          Tenant-reported issues, across your portfolio.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
            No maintenance requests yet.
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map(({ ticket, unitNumber, propertyName, vendorName }) => (
                <tr key={ticket.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium">
                      {ticket.category} — {propertyName} / {unitNumber}
                    </div>
                    <div className="text-[11px] text-[var(--color-ink-400)] mt-0.5 max-w-sm">
                      {ticket.description}
                    </div>
                    {vendorName && (
                      <div className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                        Vendor: {vendorName}
                      </div>
                    )}
                    {ticket.costCents != null && (
                      <div className="text-[11px] text-[var(--color-ink-400)] tnum mt-0.5">
                        Cost: KES {(ticket.costCents / 100).toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS_TONE[ticket.status]}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <TicketActions ticketId={ticket.id} status={ticket.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
