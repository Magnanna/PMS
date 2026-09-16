import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { invoices, invoiceLines, paymentAllocations } from "@/db/schema";

/**
 * US-C7 (minimal v1 slice — oldest-first only; credit balances and manual
 * re-allocation are the rest of that story, not yet built).
 *
 * Allocates a payment's amount across a lease's open/partially-paid
 * invoices, oldest billing_period first. Returns the allocations made and
 * any leftover amount that couldn't be applied to an invoice (overpayment —
 * currently just reported, not yet turned into a credit balance; see
 * US-C7's remaining scope).
 */
export async function allocateOldestFirst(
  leaseId: string,
  paymentId: string,
  amountCents: number
): Promise<{ allocatedCents: number; leftoverCents: number }> {
  const openInvoices = await db
    .select({ id: invoices.id, billingPeriod: invoices.billingPeriod })
    .from(invoices)
    .where(
      and(eq(invoices.leaseId, leaseId), inArray(invoices.status, ["open", "partially_paid"]))
    )
    .orderBy(asc(invoices.billingPeriod));

  let remaining = amountCents;
  let allocatedCents = 0;

  for (const invoice of openInvoices) {
    if (remaining <= 0) break;

    const balance = await invoiceBalanceCents(invoice.id);
    if (balance <= 0) continue;

    const toAllocate = Math.min(balance, remaining);

    await db.insert(paymentAllocations).values({
      paymentId,
      invoiceId: invoice.id,
      amountCents: toAllocate,
    });

    const newBalance = balance - toAllocate;
    await db
      .update(invoices)
      .set({ status: newBalance === 0 ? "paid" : "partially_paid" })
      .where(eq(invoices.id, invoice.id));

    remaining -= toAllocate;
    allocatedCents += toAllocate;
  }

  return { allocatedCents, leftoverCents: remaining };
}

/** Invoice total (sum of lines) minus total allocated so far. */
export async function invoiceBalanceCents(invoiceId: string): Promise<number> {
  const lines = await db
    .select({ amountCents: invoiceLines.amountCents })
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId));
  const total = lines.reduce((sum, l) => sum + l.amountCents, 0);

  const allocations = await db
    .select({ amountCents: paymentAllocations.amountCents })
    .from(paymentAllocations)
    .where(eq(paymentAllocations.invoiceId, invoiceId));
  const allocated = allocations.reduce((sum, a) => sum + a.amountCents, 0);

  return total - allocated;
}
