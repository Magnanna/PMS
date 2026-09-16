/**
 * Generic stateless HMAC-signed, expiring token — the shared primitive
 * behind pay-link.ts (US-H3) and tenant-invite.ts (US-A4). Pure (no DB, no
 * env, no "server-only") so it's directly unit-testable; the two call
 * sites wrap it with their own secret/TTL choices.
 */
import crypto from "crypto";

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Base64url-encoded `${subject}.${expiresAtMs}.${signature}`. */
export function createSignedToken(subject: string, ttlMs: number, secret: string): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${subject}.${expiresAt}`;
  return Buffer.from(`${payload}.${sign(payload, secret)}`).toString("base64url");
}

/** Returns the subject if the token's signature is valid and it hasn't
 *  expired; null otherwise (tampered, malformed, or expired — same result
 *  for all three, deliberately, so a caller can't distinguish "expired"
 *  from "forged" and use that as an oracle). */
export function verifySignedToken(token: string, secret: string, now: number = Date.now()): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [subject, expiresAtStr, sig] = parts;

    const expected = sign(`${subject}.${expiresAtStr}`, secret);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || now > expiresAt) return null;

    return subject;
  } catch {
    return null;
  }
}
