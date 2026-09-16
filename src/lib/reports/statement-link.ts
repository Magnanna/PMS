import "server-only";
import { env } from "@/env";
import { createSignedToken, verifySignedToken } from "@/lib/security/signed-token";

/** US-G4: shareable, QR-verifiable statement link — same stateless HMAC
 *  pattern as pay-link.ts/tenant-invite.ts. 30-day expiry (statements are
 *  shared with banks/sponsors, longer-lived than a pay link). */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createStatementToken(leaseId: string): string {
  return createSignedToken(leaseId, TTL_MS, env.MPESA_CREDENTIALS_ENC_KEY);
}

export function verifyStatementToken(token: string): { leaseId: string } | null {
  const leaseId = verifySignedToken(token, env.MPESA_CREDENTIALS_ENC_KEY);
  return leaseId ? { leaseId } : null;
}

export function statementUrl(token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/statement/${token}`;
}
