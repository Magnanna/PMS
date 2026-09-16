import "server-only";
import { env } from "@/env";
import { createSignedToken, verifySignedToken } from "@/lib/security/signed-token";

/**
 * US-H3: signed, expiring, single-invoice pay links — no login required.
 * Stateless (HMAC-signed, not DB-tracked), so "revocable" per invoice isn't
 * built yet: the token is valid until it expires, not individually
 * revocable. Rotation happens naturally since a new invoice gets a new
 * token; re-sending a link for the SAME invoice re-signs with a fresh
 * expiry rather than reusing a stored one.
 */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createPayLinkToken(invoiceId: string, ttlMs: number = DEFAULT_TTL_MS): string {
  return createSignedToken(invoiceId, ttlMs, env.MPESA_CREDENTIALS_ENC_KEY);
}

export function verifyPayLinkToken(token: string): { invoiceId: string } | null {
  const invoiceId = verifySignedToken(token, env.MPESA_CREDENTIALS_ENC_KEY);
  return invoiceId ? { invoiceId } : null;
}

export function payLinkUrl(token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/pay/${token}`;
}
