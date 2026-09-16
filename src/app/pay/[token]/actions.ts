"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, leases, units, properties, tenantProfiles, mpesaCredentials, payments } from "@/db/schema";
import { verifyPayLinkToken } from "@/lib/payments/pay-link";
import { requestStkPush, type MpesaCredentials } from "@/lib/payments/mpesaDaraja";
import { invoiceBalanceCents } from "@/lib/payments/allocate";
import { normalizeKenyanPhone } from "@/lib/payments/phone";
import { isRateLimited } from "@/lib/rate-limit";

export type PayLinkView = {
  invoiceReference: string;
  billingPeriod: string;
  balanceCents: number;
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  tenantPhone: string;
} | { error: string };

export async function getPayLinkView(token: string): Promise<PayLinkView> {
  const verified = verifyPayLinkToken(token);
  if (!verified) return { error: "This payment link has expired or is invalid." };

  const [row] = await db
    .select({
      invoice: invoices,
      lease: leases,
      unit: units,
      property: properties,
      tenant: tenantProfiles,
    })
    .from(invoices)
    .innerJoin(leases, eq(invoices.leaseId, leases.id))
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .innerJoin(tenantProfiles, eq(leases.tenantProfileId, tenantProfiles.id))
    .where(eq(invoices.id, verified.invoiceId));

  if (!row) return { error: "Invoice not found." };

  const balanceCents = await invoiceBalanceCents(row.invoice.id);

  return {
    invoiceReference: row.invoice.reference,
    billingPeriod: row.invoice.billingPeriod,
    balanceCents,
    propertyName: row.property.name,
    unitNumber: row.unit.unitNumber,
    tenantName: row.tenant.name,
    tenantPhone: row.tenant.phone,
  };
}

export type PayActionState = { error: string | null; sent?: boolean };

export async function initiatePublicStkPush(
  token: string,
  _prev: PayActionState,
  formData: FormData
): Promise<PayActionState> {
  const verified = verifyPayLinkToken(token);
  if (!verified) return { error: "This payment link has expired or is invalid." };

  if (isRateLimited(`pay-link:${verified.invoiceId}`, 5, 10 * 60 * 1000)) {
    return { error: "Too many attempts for this invoice — try again in a few minutes." };
  }

  const phoneInput = String(formData.get("phone") ?? "");
  let phone: string;
  try {
    phone = normalizeKenyanPhone(phoneInput);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid phone number" };
  }

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, verified.invoiceId));
  if (!invoice) return { error: "Invoice not found." };

  const balanceCents = await invoiceBalanceCents(invoice.id);
  if (balanceCents <= 0) return { error: "This invoice is already fully paid." };

  const [creds] = await db
    .select()
    .from(mpesaCredentials)
    .where(eq(mpesaCredentials.orgId, invoice.orgId));
  if (!creds) return { error: "This landlord hasn't connected M-Pesa yet." };

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
    const result = await requestStkPush(invoice.orgId, gatewayCreds, {
      phone,
      amountCents: balanceCents,
      accountRef: invoice.reference,
      description: `Rent ${invoice.billingPeriod.slice(0, 7)}`,
    });
    checkoutRequestId = result.checkoutRequestId;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "STK push failed" };
  }

  await db.insert(payments).values({
    orgId: invoice.orgId,
    leaseId: invoice.leaseId,
    method: "mpesa_stk",
    status: "pending",
    amountCents: balanceCents,
    providerRequestRef: checkoutRequestId,
  });

  return { error: null, sent: true };
}
