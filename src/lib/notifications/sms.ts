import "server-only";
import { db } from "@/db";
import { notificationLog } from "@/db/schema";
import { sendViaAdvanta } from "@/lib/sms/advanta";
import { normalizeKenyanPhone } from "@/lib/payments/phone";
import { env } from "@/env";

/**
 * US-F1/F2: send an SMS and log it to notification_log regardless of
 * outcome (delivery logging AC) — a failure falls back to "logged as
 * failed", not silently dropped. Email fallback on SMS failure is noted as
 * a follow-up (no email-sending infra wired yet).
 */
export async function sendTenantSms(input: {
  orgId: string;
  tenantProfileId: string;
  phone: string;
  template: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  let normalized: string;
  try {
    normalized = normalizeKenyanPhone(input.phone);
  } catch (e) {
    await db.insert(notificationLog).values({
      orgId: input.orgId,
      tenantProfileId: input.tenantProfileId,
      channel: "sms",
      template: input.template,
      status: "failed",
      failureReason: e instanceof Error ? e.message : "Invalid phone number",
    });
    return { ok: false, error: "Invalid phone number" };
  }

  const result = await sendViaAdvanta(
    {
      apiKey: env.ADVANTA_API_KEY,
      partnerId: env.ADVANTA_PARTNER_ID,
      senderId: env.ADVANTA_SENDER_ID,
    },
    normalized,
    input.message
  );

  await db.insert(notificationLog).values({
    orgId: input.orgId,
    tenantProfileId: input.tenantProfileId,
    channel: "sms",
    template: input.template,
    status: result.ok ? "sent" : "failed",
    gatewayId: result.providerRef ?? null,
    failureReason: result.error ?? null,
  });

  return { ok: result.ok, error: result.error };
}
