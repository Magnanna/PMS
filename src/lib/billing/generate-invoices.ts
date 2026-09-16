import { and, eq, lte, gte, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leases, invoices, invoiceLines } from "@/db/schema";
import { nairobiToday, billingPeriodFor, dueDateFor, invoiceReference } from "./period";

/**
 * US-C1: generate this period's rent invoice for every active lease whose
 * billing day has arrived, for the given org (or all orgs if omitted).
 * Idempotent via the unique (lease_id, billing_period) index — safe to call
 * repeatedly (cron retries, manual re-trigger) without duplicating invoices.
 * `referenceDate` is an explicit arg (Section 12: every cron job takes one)
 * so a specific day can be re-run/tested rather than always using "now".
 */
export async function generateMonthlyInvoices(
  referenceDate: Date = new Date(),
  orgId?: string
): Promise<{ created: number; skipped: number }> {
  const { year, month, day } = nairobiToday(referenceDate);
  const billingPeriod = billingPeriodFor(year, month);

  const candidates = await db
    .select({
      leaseId: leases.id,
      orgId: leases.orgId,
      billingDay: leases.billingDay,
      rentAmountCents: leases.rentAmountCents,
      unitId: leases.unitId,
    })
    .from(leases)
    .where(
      and(
        eq(leases.status, "active"),
        lte(leases.billingDay, day),
        orgId ? eq(leases.orgId, orgId) : undefined,
        or(isNull(leases.endDate), gte(leases.endDate, billingPeriod))
      )
    );

  let created = 0;
  let skipped = 0;

  for (const lease of candidates) {
    const reference = invoiceReference(lease.unitId, year, month);

    const inserted = await db
      .insert(invoices)
      .values({
        orgId: lease.orgId,
        leaseId: lease.leaseId,
        billingPeriod,
        dueDate: dueDateFor(year, month, lease.billingDay),
        reference,
        status: "open",
      })
      .onConflictDoNothing({ target: [invoices.leaseId, invoices.billingPeriod] })
      .returning({ id: invoices.id });

    if (inserted.length === 0) {
      skipped++;
      continue;
    }

    await db.insert(invoiceLines).values({
      invoiceId: inserted[0].id,
      kind: "rent",
      description: `Rent — ${billingPeriod.slice(0, 7)}`,
      amountCents: lease.rentAmountCents,
    });

    created++;
  }

  return { created, skipped };
}
