/**
 * US-J3 impersonation session token: encodes the impersonation_sessions.id
 * as the subject of the shared signed-token primitive. Pure encode/decode
 * (no DB, no "server-only") so it's directly unit-testable; the cookie
 * value IS this token, verified against the DB row (expiry/endedAt) by the
 * caller in src/lib/auth/session.ts.
 */
import { createSignedToken, verifySignedToken } from "./signed-token";

export const IMPERSONATION_COOKIE = "pms_impersonation";
export const IMPERSONATION_TTL_MS = 30 * 60 * 1000; // 30 minutes, per PRD "time-boxed"

export function createImpersonationToken(sessionId: string, secret: string): string {
  return createSignedToken(sessionId, IMPERSONATION_TTL_MS, secret);
}

export function verifyImpersonationToken(token: string, secret: string, now?: number): string | null {
  return verifySignedToken(token, secret, now);
}
