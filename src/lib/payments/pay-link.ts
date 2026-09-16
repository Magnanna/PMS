import "server-only";
import crypto from "crypto";
import { env } from "@/env";

/**
 * US-H3: signed, expiring, single-invoice pay links — no login required.
 * Stateless (HMAC-signed, not DB-tracked), so "revocable" per invoice isn't
 * built yet: the token is valid until it expires, not individually
 * revocable. Rotation happens naturally since a new invoice gets a new
 * token; re-sending a link for the SAME invoice re-signs with a fresh
 * expiry rather than reusing a stored one.
 */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
  // Reuses the M-Pesa credential encryption key as the HMAC secret — both
  // are "a server-only secret that must never leak", no reason to manage
  // a second one for v1.
  return env.MPESA_CREDENTIALS_ENC_KEY;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Base64url-encoded `${invoiceId}.${expiresAtMs}`, HMAC-signed. */
export function createPayLinkToken(invoiceId: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${invoiceId}.${expiresAt}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyPayLinkToken(token: string): { invoiceId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [invoiceId, expiresAtStr, sig] = parts;

    const expected = sign(`${invoiceId}.${expiresAtStr}`);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

    return { invoiceId };
  } catch {
    return null;
  }
}

export function payLinkUrl(token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/pay/${token}`;
}
