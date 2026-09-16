import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  receipts,
  payments,
  leases,
  units,
  properties,
  tenantProfiles,
  orgs,
  paymentAllocations,
  invoices,
  invoiceLines,
} from "@/db/schema";

/** Public lookup: everything a receipt view needs, keyed by its unguessable
 *  token — this token IS the authorization (US-D1: "QR-coded, verifiable
 *  receipt"), no login required. Returns null for an unknown token. */
export async function getReceiptByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;

  const [row] = await db
    .select({
      receipt: receipts,
      payment: payments,
      lease: leases,
      unit: units,
      property: properties,
      tenant: tenantProfiles,
      org: orgs,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .innerJoin(leases, eq(payments.leaseId, leases.id))
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .innerJoin(tenantProfiles, eq(leases.tenantProfileId, tenantProfiles.id))
    .innerJoin(orgs, eq(receipts.orgId, orgs.id))
    .where(eq(receipts.token, token));

  if (!row) return null;

  const allocations = await db
    .select({
      invoiceId: paymentAllocations.invoiceId,
      amountCents: paymentAllocations.amountCents,
      billingPeriod: invoices.billingPeriod,
    })
    .from(paymentAllocations)
    .innerJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
    .where(eq(paymentAllocations.paymentId, row.payment.id));

  const lineDescriptions = await Promise.all(
    allocations.map(async (a) => {
      const lines = await db
        .select({ description: invoiceLines.description, kind: invoiceLines.kind })
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, a.invoiceId));
      return { ...a, lines };
    })
  );

  return { ...row, allocations: lineDescriptions };
}
