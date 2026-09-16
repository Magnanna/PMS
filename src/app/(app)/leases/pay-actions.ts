"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leases, tenantProfiles, invoices, mpesaCredentials, payments } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { requestStkPush, type MpesaCredentials } from "@/lib/payments/mpesaDaraja";
import { invoiceBalanceCents } from "@/lib/payments/allocate";

/**
 * US-C2 (staff-initiated slice — the tenant-facing "Pay now" button in the
 * tenant portal is Epic H/M4; this is the landlord-side trigger so the STK
 * push + webhook + ledger path can ship and be tested before that portal
 * exists). Charges the oldest open invoice's remaining balance.
 */
export async function chargeRentViaMpesa(
  leaseId: string
): Promise<{ error: string | null }> {
  const { orgId } = await requireOrgMembership();

  const [lease] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.id, leaseId), eq(leases.orgId, orgId)));
  if (!lease) return { error: "Lease not found" };

  const [tenant] = await db
    .select()
    .from(tenantProfiles)
    .where(eq(tenantProfiles.id, lease.tenantProfileId));
  if (!tenant) return { error: "Tenant not found" };

  const [oldestOpenInvoice] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.leaseId, leaseId), inArray(invoices.status, ["open", "partially_paid"]))
    )
    .orderBy(asc(invoices.billingPeriod))
    .limit(1);

  if (!oldestOpenInvoice) return { error: "No outstanding invoice for this lease" };

  const balanceCents = await invoiceBalanceCents(oldestOpenInvoice.id);
  if (balanceCents <= 0) return { error: "This invoice is already fully paid" };

  const [creds] = await db
    .select()
    .from(mpesaCredentials)
    .where(eq(mpesaCredentials.orgId, orgId));
  if (!creds) return { error: "Connect M-Pesa first in Settings → M-Pesa" };

  const gatewayCreds: MpesaCredentials = {
    shortcodeType: creds.shortcodeType as MpesaCredentials["shortcodeType"],
    shortcode: creds.shortcode,
    consumerKeyEncrypted: creds.consumerKeyEncrypted,
    consumerSecretEncrypted: creds.consumerSecretEncrypted,
    passkeyEncrypted: creds.passkeyEncrypted,
    environment: creds.environment as MpesaCredentials["environment"],
    webhookToken: creds.webhookToken,
  };

  let checkoutRequestId: string;
  try {
    const result = await requestStkPush(orgId, gatewayCreds, {
      phone: tenant.phone,
      amountCents: balanceCents,
      accountRef: oldestOpenInvoice.reference,
      description: `Rent ${oldestOpenInvoice.billingPeriod.slice(0, 7)}`,
    });
    checkoutRequestId = result.checkoutRequestId;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "STK push failed" };
  }

  await db.insert(payments).values({
    orgId,
    leaseId,
    method: "mpesa_stk",
    status: "pending",
    amountCents: balanceCents,
    providerRequestRef: checkoutRequestId,
  });

  return { error: null };
}
