"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mpesaCredentials } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { encryptSecret } from "@/lib/payments/crypto";
import { testMpesaConnection } from "@/lib/payments/mpesaDaraja";

const credentialsSchema = z.object({
  shortcodeType: z.enum(["paybill", "till"]),
  shortcode: z.string().min(1, "Shortcode is required"),
  consumerKey: z.string().min(1, "Consumer key is required"),
  consumerSecret: z.string().min(1, "Consumer secret is required"),
  passkey: z.string().optional(),
  environment: z.enum(["sandbox", "live"]),
});

export type FormState = { error: string | null; success?: boolean };

/** US-C10: connect (or update) the org's own Daraja credentials. Secrets are
 *  encrypted before they ever reach a `.values()` call — never logged, never
 *  round-tripped back to the client after save. */
export async function saveMpesaCredentials(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "org:manage_mpesa_credentials");

  const parsed = credentialsSchema.safeParse({
    shortcodeType: formData.get("shortcodeType"),
    shortcode: formData.get("shortcode"),
    consumerKey: formData.get("consumerKey"),
    consumerSecret: formData.get("consumerSecret"),
    passkey: formData.get("passkey") || undefined,
    environment: formData.get("environment"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [existing] = await db
    .select({ webhookToken: mpesaCredentials.webhookToken })
    .from(mpesaCredentials)
    .where(eq(mpesaCredentials.orgId, orgId));

  const values = {
    orgId,
    shortcodeType: parsed.data.shortcodeType,
    shortcode: parsed.data.shortcode,
    consumerKeyEncrypted: encryptSecret(parsed.data.consumerKey),
    consumerSecretEncrypted: encryptSecret(parsed.data.consumerSecret),
    passkeyEncrypted: parsed.data.passkey ? encryptSecret(parsed.data.passkey) : null,
    environment: parsed.data.environment,
    webhookToken: existing?.webhookToken ?? crypto.randomBytes(24).toString("hex"),
  };

  if (existing) {
    await db.update(mpesaCredentials).set(values).where(eq(mpesaCredentials.orgId, orgId));
  } else {
    await db.insert(mpesaCredentials).values(values);
  }

  revalidatePath("/settings/mpesa");
  return { error: null, success: true };
}

/** Test button: fetches a Daraja OAuth token with the saved credentials —
 *  confirms consumer key/secret are valid without sending a real STK push. */
export async function testMpesaCredentials(): Promise<{ error: string | null }> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "org:manage_mpesa_credentials");

  const [creds] = await db
    .select()
    .from(mpesaCredentials)
    .where(eq(mpesaCredentials.orgId, orgId));

  if (!creds) return { error: "No M-Pesa credentials saved yet" };

  try {
    await testMpesaConnection({
      shortcodeType: creds.shortcodeType as "paybill" | "till",
      shortcode: creds.shortcode,
      consumerKeyEncrypted: creds.consumerKeyEncrypted,
      consumerSecretEncrypted: creds.consumerSecretEncrypted,
      passkeyEncrypted: creds.passkeyEncrypted,
      environment: creds.environment as "sandbox" | "live",
      webhookToken: creds.webhookToken,
    });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Connection failed" };
  }
}

export async function getMpesaCredentialsSummary() {
  const { orgId } = await requireOrgMembership();
  const [creds] = await db
    .select()
    .from(mpesaCredentials)
    .where(eq(mpesaCredentials.orgId, orgId));

  if (!creds) return null;

  return {
    shortcodeType: creds.shortcodeType,
    shortcode: creds.shortcode,
    environment: creds.environment,
    // Never return the decrypted secrets to the client — decrypt is only
    // ever used server-side inside mpesaDaraja.ts request calls.
  };
}
