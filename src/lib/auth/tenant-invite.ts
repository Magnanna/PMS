import "server-only";
import crypto from "crypto";
import { env } from "@/env";

/**
 * US-A4: signed, expiring, single-tenant-profile invite token — same
 * stateless HMAC pattern as pay-link.ts. 7-day expiry, resendable (a new
 * invite just re-signs, no revoke-list needed since the old token simply
 * expires).
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.MPESA_CREDENTIALS_ENC_KEY).update(payload).digest("base64url");
}

export function createTenantInviteToken(tenantProfileId: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${tenantProfileId}.${expiresAt}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

export function verifyTenantInviteToken(token: string): { tenantProfileId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [tenantProfileId, expiresAtStr, sig] = parts;

    const expected = sign(`${tenantProfileId}.${expiresAtStr}`);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

    return { tenantProfileId };
  } catch {
    return null;
  }
}

export function tenantInviteUrl(token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/tenant/claim/${token}`;
}
