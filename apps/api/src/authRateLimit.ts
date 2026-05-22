export type AuthRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type AuthRateLimitBucket = {
  attempts: number;
  windowExpiresAt: number;
  blockedUntil: number;
};

export type AuthRateLimiter = {
  check(input: AuthRateLimitInput): AuthRateLimitDecision;
  recordFailure(input: AuthRateLimitInput): void;
  recordSuccess(input: AuthRateLimitInput): void;
};

type AuthRateLimitInput = {
  email: string;
  ip: string | null;
  now?: number;
};

type AuthRateLimiterOptions = {
  maxFailures: number;
  windowMs: number;
  blockMs: number;
};

type ClientIpOptions = {
  trustForwardedHeaders?: boolean;
};

const defaultOptions: AuthRateLimiterOptions = {
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000
};

export function createAuthRateLimiter(
  options: Partial<AuthRateLimiterOptions> = {}
): AuthRateLimiter {
  const resolvedOptions = { ...defaultOptions, ...options };
  const emailBuckets = new Map<string, AuthRateLimitBucket>();
  const ipBuckets = new Map<string, AuthRateLimitBucket>();

  function check(input: AuthRateLimitInput): AuthRateLimitDecision {
    const now = input.now ?? Date.now();
    const ip = normalizeIp(input.ip);
    const retryAfterMs = Math.max(
      getRetryAfterMs(emailBuckets, normalizeEmail(input.email), now),
      ip ? getRetryAfterMs(ipBuckets, ip, now) : 0
    );

    if (retryAfterMs <= 0) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
    };
  }

  function recordFailure(input: AuthRateLimitInput): void {
    const now = input.now ?? Date.now();
    const ip = normalizeIp(input.ip);
    recordFailureInBucket(
      emailBuckets,
      normalizeEmail(input.email),
      now,
      resolvedOptions
    );
    if (ip) recordFailureInBucket(ipBuckets, ip, now, resolvedOptions);
  }

  function recordSuccess(input: AuthRateLimitInput): void {
    emailBuckets.delete(normalizeEmail(input.email));
  }

  return {
    check,
    recordFailure,
    recordSuccess
  };
}

export function getClientIp(headers: {
  get(name: string): string | null;
}, options: ClientIpOptions = {}): string | null {
  if (!options.trustForwardedHeaders) return null;

  return (
    firstForwardedIp(headers.get("cf-connecting-ip")) ??
    firstForwardedIp(headers.get("x-real-ip")) ??
    firstForwardedIp(headers.get("x-forwarded-for")) ??
    null
  );
}

export function shouldTrustForwardedAuthHeaders(
  env: Partial<Pick<NodeJS.ProcessEnv, "KISS_PM_TRUST_PROXY_HEADERS">> = process.env
): boolean {
  return env.KISS_PM_TRUST_PROXY_HEADERS === "true";
}

function getRetryAfterMs(
  buckets: Map<string, AuthRateLimitBucket>,
  key: string,
  now: number
): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  if (bucket.windowExpiresAt <= now && bucket.blockedUntil <= now) {
    buckets.delete(key);
    return 0;
  }
  return Math.max(0, bucket.blockedUntil - now);
}

function recordFailureInBucket(
  buckets: Map<string, AuthRateLimitBucket>,
  key: string,
  now: number,
  options: AuthRateLimiterOptions
): void {
  const existing = buckets.get(key);
  const bucket =
    existing && existing.windowExpiresAt > now
      ? existing
      : {
          attempts: 0,
          windowExpiresAt: now + options.windowMs,
          blockedUntil: 0
        };

  bucket.attempts += 1;
  if (bucket.attempts >= options.maxFailures) {
    bucket.blockedUntil = now + options.blockMs;
  }
  buckets.set(key, bucket);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase() || "unknown-email";
}

function normalizeIp(ip: string | null): string | null {
  const normalized = ip?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function firstForwardedIp(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}
