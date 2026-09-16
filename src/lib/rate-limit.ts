/**
 * In-memory sliding-window rate limiter — good enough for a single-instance
 * dev/early-production deployment, resets on redeploy/restart. Swap for a
 * Redis/Upstash-backed limiter before running multiple instances (follow-up
 * hardening, not a blocker for this story).
 */
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return false;
}
