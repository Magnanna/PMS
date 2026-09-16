import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  leases,
  units,
  properties,
  tenantProfiles,
  orgs,
  invoices,
  invoiceLines,
  payments,
  paymentAllocations,
} from "@/db/schema";

export type StatementLine = {
  date: string;
  description: string;
  chargeCents: number;
  paidCents: number;
};

export type TenantStatement = {
  orgName: string;
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  lines: StatementLine[];
  totalChargedCents: number;
  totalPaidCents: number;
  balanceCents: number;
} | null;

/** US-G4: full lease history (charges, payments, running balance) — for
 *  banks, sponsors, or disputes. Built entirely from the ledger-adjacent
 *  invoice/payment-allocation tables (never a cached "balance" field). */
export async function computeTenantStatement(leaseId: string): Promise<TenantStatement> {
  const [row] = await db
    .select({
      lease: leases,
      unit: units,
      property: properties,
      tenant: tenantProfiles,
      org: orgs,
    })
    .from(leases)
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .innerJoin(tenantProfiles, eq(leases.tenantProfileId, tenantProfiles.id))
    .innerJoin(orgs, eq(leases.orgId, orgs.id))
    .where(eq(leases.id, leaseId));

  if (!row) return null;

  const invoiceRows = await db
    .select({
      id: invoices.id,
      billingPeriod: invoices.billingPeriod,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(eq(invoices.leaseId, leaseId))
    .orderBy(asc(invoices.billingPeriod));

  const lines: StatementLine[] = [];
  let totalChargedCents = 0;
  let totalPaidCents = 0;

  for (const invoice of invoiceRows) {
    const invLines = await db
      .select({ description: invoiceLines.description, amountCents: invoiceLines.amountCents })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoice.id));

    const chargeCents = invLines.reduce((sum, l) => sum + l.amountCents, 0);
    totalChargedCents += chargeCents;

    const allocations = await db
      .select({ amountCents: paymentAllocations.amountCents })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoice.id));
    const paidCents = allocations.reduce((sum, a) => sum + a.amountCents, 0);
    totalPaidCents += paidCents;

    lines.push({
      date: invoice.dueDate,
      description: invLines.map((l) => l.description).join(", ") || `Rent — ${invoice.billingPeriod.slice(0, 7)}`,
      chargeCents,
      paidCents,
    });
  }

  // Any confirmed payment not yet allocated to an invoice (credit balance,
  // US-C7) still shows as money received.
  const unallocatedPayments = await db
    .select({ id: payments.id, amountCents: payments.amountCents, paidAt: payments.paidAt })
    .from(payments)
    .where(and(eq(payments.leaseId, leaseId), eq(payments.status, "confirmed")));

  for (const payment of unallocatedPayments) {
    const allocated = await db
      .select({ amountCents: paymentAllocations.amountCents })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, payment.id));
    const allocatedTotal = allocated.reduce((sum, a) => sum + a.amountCents, 0);
    const leftover = payment.amountCents - allocatedTotal;
    if (leftover > 0) {
      totalPaidCents += leftover;
      lines.push({
        date: payment.paidAt.toISOString().slice(0, 10),
        description: "Unapplied payment (credit balance)",
        chargeCents: 0,
        paidCents: leftover,
      });
    }
  }

  return {
    orgName: row.org.name,
    propertyName: row.property.name,
    unitNumber: row.unit.unitNumber,
    tenantName: row.tenant.name,
    lines,
    totalChargedCents,
    totalPaidCents,
    balanceCents: totalChargedCents - totalPaidCents,
  };
}
