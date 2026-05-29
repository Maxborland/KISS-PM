/**
 * Lightweight in-memory rate limiter. Sufficient for a single-instance
 * landing node. For multi-instance deploys replace with Redis / Upstash.
 */

interface Slot {
  count: number;
  resetAt: number;
}

const BUCKET = new Map<string, Slot>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryInMs: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const slot = BUCKET.get(key);
  if (!slot || slot.resetAt <= now) {
    BUCKET.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryInMs: 0 };
  }
  if (slot.count >= opts.limit) {
    return { ok: false, retryInMs: slot.resetAt - now };
  }
  slot.count += 1;
  return { ok: true, retryInMs: 0 };
}

/** Test helper. */
export function _resetRateLimit(): void {
  BUCKET.clear();
}
