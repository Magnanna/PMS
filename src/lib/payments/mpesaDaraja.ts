/**
 * Adapted from zoho-books-clone ("Zeno") src/lib/payments/mpesaDaraja.ts
 * (tested, working there) — reads credentials from our per-org
 * mpesa_credentials_per_org columns instead of Zeno's single JSON config
 * blob, and drops payOut/B2C (out of scope for v1, PRD non-goal). See
 * docs/PORTED.md.
 */
import { normalizeKenyanPhone } from "./phone";
import { decryptSecret } from "./crypto";

export type MpesaCredentials = {
  shortcodeType: "paybill" | "till";
  shortcode: string;
  consumerKeyEncrypted: string;
  consumerSecretEncrypted: string;
  passkeyEncrypted: string | null;
  environment: "sandbox" | "live";
  webhookToken: string;
};

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PROD_BASE = "https://api.safaricom.co.ke";

/** Site URL for callback URLs — the single source per docs/DESIGN.md, never
 *  hard-coded in a component or here. */
function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL is not set — cannot build M-Pesa callback URLs");
  return url.replace(/\/$/, "");
}

/**
 * Daraja validates AccountReference/TransactionDesc as alphanumeric and
 * rejects the payload (USSD_103) on punctuation — invoice references like
 * "INV-0001" would fail, so strip anything else before truncating.
 */
function safeRef(raw: string, max: number): string {
  return (raw || "").replace(/[^A-Za-z0-9]/g, "").slice(0, max) || "PAYMENT";
}

async function getAccessToken(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<string> {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error("Failed to get M-Pesa access token — check consumer key/secret");
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** US-C10: connection test — verifies the consumer key/secret pair works. */
export async function testMpesaConnection(creds: MpesaCredentials): Promise<void> {
  const baseUrl = creds.environment === "live" ? PROD_BASE : SANDBOX_BASE;
  await getAccessToken(
    baseUrl,
    decryptSecret(creds.consumerKeyEncrypted),
    decryptSecret(creds.consumerSecretEncrypted)
  );
}

/** US-C2: trigger an STK push to the tenant's phone. Returns the Daraja
 *  CheckoutRequestID — store it on the pending payment row so the callback
 *  (which carries the same id) can find it. */
export async function requestStkPush(
  orgId: string,
  creds: MpesaCredentials,
  input: {
    phone: string;
    amountCents: number;
    accountRef: string; // invoice reference — echoed back in the callback
    description: string;
  }
): Promise<{ checkoutRequestId: string }> {
  if (!creds.passkeyEncrypted) {
    throw new Error("M-Pesa passkey is not set for this org — add it in Settings → M-Pesa");
  }

  const baseUrl = creds.environment === "live" ? PROD_BASE : SANDBOX_BASE;
  const consumerKey = decryptSecret(creds.consumerKeyEncrypted);
  const consumerSecret = decryptSecret(creds.consumerSecretEncrypted);
  const passkey = decryptSecret(creds.passkeyEncrypted);

  const msisdn = normalizeKenyanPhone(input.phone);
  const token = await getAccessToken(baseUrl, consumerKey, consumerSecret);
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const password = Buffer.from(`${creds.shortcode}${passkey}${timestamp}`).toString("base64");

  const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: creds.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType:
        creds.shortcodeType === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
      Amount: Math.ceil(input.amountCents / 100),
      PartyA: msisdn,
      PartyB: creds.shortcode,
      PhoneNumber: msisdn,
      CallBackURL: `${siteUrl()}/api/payments/webhook/mpesa?orgId=${orgId}&token=${creds.webhookToken}`,
      AccountReference: safeRef(input.accountRef, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`M-Pesa STK push failed: ${err}`);
  }

  const data = (await res.json()) as { CheckoutRequestID?: string };
  if (!data.CheckoutRequestID) {
    throw new Error(`M-Pesa STK push returned no CheckoutRequestID: ${JSON.stringify(data)}`);
  }
  return { checkoutRequestId: data.CheckoutRequestID };
}

export type InboundPayment = {
  providerRef: string; // M-Pesa receipt number / TransID — idempotency key
  amountCents: number;
  payerPhone?: string;
  payerName?: string;
  accountRef?: string; // what the customer typed (C2B) or the invoice ref (STK)
  requestRef?: string; // CheckoutRequestID, for STK — links back to the pending payment
  paidAt: string;
};

export type InboundFailure = { failed: true; requestRef: string };

export type InboundResult = InboundPayment | InboundFailure;

export function isInboundFailure(r: InboundResult): r is InboundFailure {
  return (r as InboundFailure).failed === true;
}

/** Parses a Daraja STK callback OR a C2B confirmation payload into one
 *  common shape. Returns null for anything unrecognized. */
export function parseMpesaCallback(body: unknown): InboundResult | null {
  const payload = body as Record<string, unknown>;

  // C2B confirmation: customer paid the paybill/till directly (no STK push)
  if (
    typeof payload?.TransID === "string" &&
    (typeof payload?.TransAmount === "string" || typeof payload?.TransAmount === "number")
  ) {
    const name = [payload.FirstName, payload.MiddleName, payload.LastName]
      .filter(Boolean)
      .join(" ");
    return {
      providerRef: String(payload.TransID),
      amountCents: Math.round(Number(payload.TransAmount) * 100),
      payerPhone: payload.MSISDN ? String(payload.MSISDN) : undefined,
      payerName: name || undefined,
      accountRef: payload.BillRefNumber ? String(payload.BillRefNumber) : undefined,
      paidAt: new Date().toISOString(),
    };
  }

  // STK push result, nested under Body.stkCallback
  const body_ = payload?.Body as Record<string, unknown> | undefined;
  const callback = body_?.stkCallback as Record<string, unknown> | undefined;
  if (!callback) return null;

  const requestRef = callback.CheckoutRequestID as string | undefined;

  if (callback.ResultCode !== 0) {
    if (requestRef) return { failed: true, requestRef };
    return null;
  }

  const metadata = callback.CallbackMetadata as
    | { Item?: Array<{ Name: string; Value: unknown }> }
    | undefined;
  const items = metadata?.Item ?? [];
  const getVal = (name: string) => items.find((i) => i.Name === name)?.Value;

  const amount = getVal("Amount");
  const mpesaReceiptNumber = getVal("MpesaReceiptNumber");
  const phoneNumber = getVal("PhoneNumber");

  if (!mpesaReceiptNumber) return null;

  return {
    providerRef: String(mpesaReceiptNumber),
    amountCents: Math.round(Number(amount) * 100),
    payerPhone: phoneNumber ? String(phoneNumber) : undefined,
    requestRef,
    paidAt: new Date().toISOString(),
  };
}
