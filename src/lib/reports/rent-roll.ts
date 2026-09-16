import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leases, units, properties, tenantProfiles, invoices } from "@/db/schema";
import { invoiceBalanceCents } from "@/lib/payments/allocate";

export type RentRollRow = {
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  rentAmountCents: number;
  arrearsCents: number;
  leaseEndDate: string | null;
  status: string;
  controlledTenancy: boolean;
};

/** US-G3: every unit/tenant, current rent, arrears, lease end — one table.
 *  Feeds US-D4's eRITS-oriented export too. */
export async function computeRentRoll(orgId: string): Promise<RentRollRow[]> {
  const rows = await db
    .select({
      leaseId: leases.id,
      rentAmountCents: leases.rentAmountCents,
      endDate: leases.endDate,
      status: leases.status,
      controlledTenancy: leases.controlledTenancy,
      unitNumber: units.unitNumber,
      propertyName: properties.name,
      tenantName: tenantProfiles.name,
    })
    .from(leases)
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .innerJoin(tenantProfiles, eq(leases.tenantProfileId, tenantProfiles.id))
    .where(and(eq(leases.orgId, orgId), eq(leases.status, "active")));

  const result: RentRollRow[] = [];

  for (const row of rows) {
    const openInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(eq(invoices.leaseId, row.leaseId), inArray(invoices.status, ["open", "partially_paid"]))
      );

    let arrearsCents = 0;
    for (const inv of openInvoices) arrearsCents += await invoiceBalanceCents(inv.id);

    result.push({
      propertyName: row.propertyName,
      unitNumber: row.unitNumber,
      tenantName: row.tenantName,
      rentAmountCents: row.rentAmountCents,
      arrearsCents,
      leaseEndDate: row.endDate,
      status: row.status,
      controlledTenancy: row.controlledTenancy,
    });
  }

  return result;
}
