/**
 * Ported from zoho-books-clone ("Zeno") src/lib/sms/advanta.ts (tested,
 * working there) — reads platform-wide credentials from env vars instead
 * of a per-org DB config (our env.ts already has ADVANTA_API_KEY/
 * ADVANTA_PARTNER_ID as top-level vars, no per-org SMS settings table in
 * our schema). See docs/PORTED.md.
 */
export type SmsResult = { ok: boolean; providerRef?: string; error?: string };

const ADVANTA_URL = "https://quicksms.advantasms.com/api/services/sendsms/";

export async function sendViaAdvanta(
  config: { apiKey?: string; partnerId?: string; senderId?: string },
  phone: string,
  message: string
): Promise<SmsResult> {
  if (!config.apiKey || !config.partnerId || !config.senderId) {
    return { ok: false, error: "Advanta SMS not fully configured (apiKey, partnerId, senderId required)" };
  }

  try {
    // Without a timeout, one slow/hanging Advanta response stalls whatever
    // called sendSms indefinitely.
    const res = await fetch(ADVANTA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: config.apiKey,
        partnerID: config.partnerId,
        shortcode: config.senderId,
        mobile: phone,
        message,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON error body
    }

    // Advanta: { responses: [{ "response-code": 200, "messageid": ..., "mobile": ... }] }
    const responses = data?.responses as Array<Record<string, unknown>> | undefined;
    const first = responses?.[0];
    const code = first?.["response-code"] ?? data?.["response-code"];

    if (res.ok && Number(code) === 200) {
      return { ok: true, providerRef: String(first?.messageid ?? "") };
    }
    return {
      ok: false,
      error: `Advanta error (${res.status}): ${first?.["response-description"] || text.slice(0, 200)}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Advanta request failed" };
  }
}
