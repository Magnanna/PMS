import "server-only";
import { env } from "@/env";
import { createSignedToken, verifySignedToken } from "@/lib/security/signed-token";

/**
 * US-A4: signed, expiring, single-tenant-profile invite token — same
 * stateless HMAC pattern as pay-link.ts. 7-day expiry, resendable (a new
 * invite just re-signs, no revoke-list needed since the old token simply
 * expires).
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createTenantInviteToken(tenantProfileId: string): string {
  return createSignedToken(tenantProfileId, TTL_MS, env.MPESA_CREDENTIALS_ENC_KEY);
}

export function verifyTenantInviteToken(token: string): { tenantProfileId: string } | null {
  const tenantProfileId = verifySignedToken(token, env.MPESA_CREDENTIALS_ENC_KEY);
  return tenantProfileId ? { tenantProfileId } : null;
}

export function tenantInviteUrl(token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/tenant/claim/${token}`;
}
