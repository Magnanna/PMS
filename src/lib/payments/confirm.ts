import "server-only";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, receipts, leases, units, orgs, tenantProfiles } from "@/db/schema";
import { allocateOldestFirst } from "./allocate";
import { postJournalEntry, type JournalLineInput } from "@/lib/ledger/posting";
import { ACCOUNTS, cashAccountForMethod } from "@/lib/ledger/accounts";
import { getTaxDevice } from "@/lib/receipts/etims";

/**
 * Orchestrates what happens once a payment is confirmed (M-Pesa callback,
 * or — in later stories — manual offline entry): allocate to invoices
 * oldest-first (US-C7 slice), post the ledger entry, generate a receipt,
 * and mark the payment confirmed. The only caller that should touch these
 * four things together — keeps them atomic-in-spirit even though we don't
 * yet wrap this in an explicit DB transaction (Drizzle+postgres-js supports
 * `db.transaction`; adding it is cheap follow-up hardening, not deferred by
 * design, just not the risk that blocks this story shipping).
 */
export async function confirmPayment(paymentId: string): Promise<void> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (payment.status !== "pending") {
    // Idempotency: a replayed webhook calling confirmPayment twice must be
    // a no-op, not a double-post.
    return;
  }

  const [lease] = await db.select().from(leases).where(eq(leases.id, payment.leaseId));
  if (!lease) throw new Error(`Lease ${payment.leaseId} not found for payment ${paymentId}`);
  const [unit] = await db.select().from(units).where(eq(units.id, lease.unitId));

  const { allocatedCents, leftoverCents } = await allocateOldestFirst(
    payment.leaseId,
    payment.id,
    payment.amountCents
  );

  const cashAccount = cashAccountForMethod(payment.method);
  const lines: JournalLineInput[] = [
    {
      account: cashAccount,
      debitCents: payment.amountCents,
      unitId: unit?.id,
      propertyId: unit?.propertyId,
    },
  ];
  if (allocatedCents > 0) {
    lines.push({
      account: ACCOUNTS.RENTAL_INCOME,
      creditCents: allocatedCents,
      unitId: unit?.id,
      propertyId: unit?.propertyId,
    });
  }
  if (leftoverCents > 0) {
    lines.push({
      account: ACCOUNTS.UNAPPLIED_RECEIPTS,
      creditCents: leftoverCents,
      unitId: unit?.id,
      propertyId: unit?.propertyId,
    });
  }

  await postJournalEntry({
    orgId: payment.orgId,
    sourceType: "payment",
    sourceId: payment.id,
    memo: `Rent payment — ${payment.method}`,
    lines,
  });

  const [org] = await db.select().from(orgs).where(eq(orgs.id, payment.orgId));
  const [tenant] = await db
    .select()
    .from(tenantProfiles)
    .where(eq(tenantProfiles.id, lease.tenantProfileId));

  const device = getTaxDevice();
  const signed = device.sign({
    sellerPin: org?.kraPin ?? "",
    buyerPin: tenant?.kraPin,
    invoiceNumber: payment.id,
    totalCents: payment.amountCents,
    taxCents: 0, // MRI is a landlord withholding tax, not a line-item tax on the rent receipt
    dateISO: new Date().toISOString(),
  });

  await db.insert(receipts).values({
    orgId: payment.orgId,
    paymentId: payment.id,
    token: crypto.randomBytes(16).toString("hex"),
    simulated: true, // real eTIMS adapter is a hard requirement before production filing use
    cuInvoiceNumber: signed.cuInvoiceNumber,
    cuSerial: signed.cuSerial,
  });

  await db.update(payments).set({ status: "confirmed" }).where(eq(payments.id, payment.id));
}
