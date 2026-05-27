import { createHash } from "node:crypto";
import { requireSecureRedisUrl } from "./redisSecurity";

export type AuthRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type MaybePromise<T> = T | Promise<T>;

type AuthRateLimitBucket = {
  attempts: number;
  pendingAttempts: number;
  windowExpiresAt: number;
  blockedUntil: number;
};

export type AuthRateLimiter = {
  check(input: AuthRateLimitInput): MaybePromise<AuthRateLimitDecision>;
  reserveAttempt?(input: AuthRateLimitInput): MaybePromise<AuthRateLimitDecision>;
  releaseReservedAttempt?(input: AuthRateLimitInput): MaybePromise<void>;
  recordFailure(input: AuthRateLimitInput, options?: AuthRateLimitRecordOptions): MaybePromise<void>;
  recordSuccess(input: AuthRateLimitInput, options?: AuthRateLimitRecordOptions): MaybePromise<void>;
  close?(): Promise<void>;
};

type AuthRateLimitInput = {
  email: string;
  ip: string | null;
  now?: number;
};

type AuthRateLimitRecordOptions = {
  reserved?: boolean;
};

type AuthRateLimiterOptions = {
  maxFailures: number;
  maxGlobalFailures: number;
  maxTrackedEmails: number;
  maxTrackedIps: number;
  windowMs: number;
  blockMs: number;
};

type ClientIpOptions = {
  trustForwardedHeaders?: boolean;
};

export type AuthRateLimitBackend = "memory" | "redis";

const defaultOptions: AuthRateLimiterOptions = {
  maxFailures: 5,
  maxGlobalFailures: 200,
  maxTrackedEmails: 5000,
  maxTrackedIps: 5000,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000
};
const maxReservationMs = 30_000;

export function createAuthRateLimiter(
  options: Partial<AuthRateLimiterOptions> = {}
): AuthRateLimiter {
  const resolvedOptions = { ...defaultOptions, ...options };
  const emailBuckets = new Map<string, AuthRateLimitBucket>();
  const ipBuckets = new Map<string, AuthRateLimitBucket>();
  const globalBucket = new Map<string, AuthRateLimitBucket>();

  function check(input: AuthRateLimitInput): AuthRateLimitDecision {
    const now = input.now ?? Date.now();
    const ip = normalizeIp(input.ip);
    const retryAfterMs = Math.max(
      getRetryAfterMs(globalBucket, "global", now),
      getRetryAfterMs(emailBuckets, normalizeEmail(input.email), now),
      ip ? getRetryAfterMs(ipBuckets, ip, now) : 0
    );

    if (retryAfterMs <= 0) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
    };
  }

  function reserveAttempt(input: AuthRateLimitInput): AuthRateLimitDecision {
    const now = input.now ?? Date.now();
    const ip = normalizeIp(input.ip);
    const reservations = [
      {
        buckets: globalBucket,
        key: "global",
        options: {
          ...resolvedOptions,
          maxFailures: resolvedOptions.maxGlobalFailures,
          maxTrackedBuckets: 1
        }
      },
      {
        buckets: emailBuckets,
        key: normalizeEmail(input.email),
        options: {
          ...resolvedOptions,
          maxTrackedBuckets: resolvedOptions.maxTrackedEmails
        }
      },
      ...(ip
        ? [
            {
              buckets: ipBuckets,
              key: ip,
              options: {
                ...resolvedOptions,
                maxTrackedBuckets: resolvedOptions.maxTrackedIps
              }
            }
          ]
        : [])
    ];
    const retryAfterMs = Math.max(
      ...reservations.map(({ buckets, key }) => getRetryAfterMs(buckets, key, now))
    );
    if (retryAfterMs > 0) return deniedDecision(retryAfterMs);

    for (const reservation of reservations) {
      const overflowRetryAfter = retryAfterForReservationOverflow(
        reservation.buckets,
        reservation.key,
        now,
        reservation.options
      );
      if (overflowRetryAfter > 0) return deniedDecision(overflowRetryAfter);
    }
    for (const reservation of reservations) {
      reserveInBucket(reservation.buckets, reservation.key, now, reservation.options);
    }
    return { allowed: true };
  }

  function releaseReservedAttempt(input: AuthRateLimitInput): void {
    const now = input.now ?? Date.now();
    const ip = normalizeIp(input.ip);
    releaseReservedAttemptInBucket(globalBucket, "global", now);
    releaseReservedAttemptInBucket(emailBuckets, normalizeEmail(input.email), now);
    if (ip) releaseReservedAttemptInBucket(ipBuckets, ip, now);
  }

  function recordFailure(input: AuthRateLimitInput, options: AuthRateLimitRecordOptions = {}): void {
    const now = input.now ?? Date.now();
    const ip = normalizeIp(input.ip);
    if (options.reserved) releaseReservedAttempt(input);
    recordFailureInBucket(globalBucket, "global", now, {
      ...resolvedOptions,
      maxFailures: resolvedOptions.maxGlobalFailures,
      maxTrackedBuckets: 1
    });
    recordFailureInBucket(
      emailBuckets,
      normalizeEmail(input.email),
      now,
      {
        ...resolvedOptions,
        maxTrackedBuckets: resolvedOptions.maxTrackedEmails
      }
    );
    if (ip) {
      recordFailureInBucket(ipBuckets, ip, now, {
        ...resolvedOptions,
        maxTrackedBuckets: resolvedOptions.maxTrackedIps
      });
    }
  }

  function recordSuccess(input: AuthRateLimitInput, options: AuthRateLimitRecordOptions = {}): void {
    if (options.reserved) releaseReservedAttempt(input);
    emailBuckets.delete(normalizeEmail(input.email));
  }

  return {
    check,
    reserveAttempt,
    releaseReservedAttempt,
    recordFailure,
    recordSuccess
  };
}

export async function createAuthRateLimiterFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Promise<AuthRateLimiter> {
  const production = env.NODE_ENV === "production";
  const backend = parseAuthRateLimitBackend(
    env.KISS_PM_AUTH_RATE_LIMIT_BACKEND,
    production
  );
  if (production && backend === "memory") {
    throw new Error("auth_rate_limit_memory_forbidden_in_production");
  }
  if (backend === "memory") return createAuthRateLimiter();

  const redisUrl = env.KISS_PM_AUTH_RATE_LIMIT_REDIS_URL ?? env.REDIS_URL;
  if (!redisUrl) throw new Error("auth_rate_limit_redis_url_required");
  return createRedisAuthRateLimiter({
    redisUrl: requireSecureRedisUrl({
      allowInsecure: env.KISS_PM_AUTH_RATE_LIMIT_REDIS_ALLOW_INSECURE === "true",
      production,
      url: redisUrl
    })
  });
}

export function parseAuthRateLimitBackend(
  value: string | undefined,
  production = false
): AuthRateLimitBackend {
  if (value === undefined || value === "") return production ? "redis" : "memory";
  if (value === "memory" || value === "redis") return value;
  throw new Error("invalid_auth_rate_limit_backend");
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

function deniedDecision(retryAfterMs: number): AuthRateLimitDecision {
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
  };
}

function retryAfterForReservationOverflow(
  buckets: Map<string, AuthRateLimitBucket>,
  key: string,
  now: number,
  options: AuthRateLimiterOptions & { maxTrackedBuckets: number }
): number {
  pruneExpiredBuckets(buckets, now);
  const existing = buckets.get(key);
  const bucket =
    existing && existing.windowExpiresAt > now
      ? existing
      : {
          attempts: 0,
          pendingAttempts: 0,
          windowExpiresAt: now + options.windowMs,
          blockedUntil: 0
        };
  if (bucket.attempts + bucket.pendingAttempts < options.maxFailures) return 0;
  return Math.min(options.windowMs, maxReservationMs);
}

function reserveInBucket(
  buckets: Map<string, AuthRateLimitBucket>,
  key: string,
  now: number,
  options: AuthRateLimiterOptions & { maxTrackedBuckets: number }
): void {
  pruneExpiredBuckets(buckets, now);
  const existing = buckets.get(key);
  const bucket =
    existing && existing.windowExpiresAt > now
      ? existing
      : {
          attempts: 0,
          pendingAttempts: 0,
          windowExpiresAt: now + options.windowMs,
          blockedUntil: 0
        };

  bucket.pendingAttempts += 1;
  if (!existing && buckets.size >= options.maxTrackedBuckets) {
    deleteOldestBucket(buckets);
  }
  buckets.set(key, bucket);
}

function releaseReservedAttemptInBucket(
  buckets: Map<string, AuthRateLimitBucket>,
  key: string,
  now: number
): void {
  const bucket = buckets.get(key);
  if (!bucket) return;
  if (bucket.windowExpiresAt <= now && bucket.blockedUntil <= now) {
    buckets.delete(key);
    return;
  }
  bucket.pendingAttempts = Math.max(0, bucket.pendingAttempts - 1);
  buckets.set(key, bucket);
}

function recordFailureInBucket(
  buckets: Map<string, AuthRateLimitBucket>,
  key: string,
  now: number,
  options: AuthRateLimiterOptions & { maxTrackedBuckets: number }
): void {
  pruneExpiredBuckets(buckets, now);
  const existing = buckets.get(key);
  const bucket =
    existing && existing.windowExpiresAt > now
      ? existing
      : {
          attempts: 0,
          pendingAttempts: 0,
          windowExpiresAt: now + options.windowMs,
          blockedUntil: 0
        };

  bucket.attempts += 1;
  if (bucket.attempts >= options.maxFailures) {
    bucket.blockedUntil = now + options.blockMs;
  }
  if (!existing && buckets.size >= options.maxTrackedBuckets) {
    deleteOldestBucket(buckets);
  }
  buckets.set(key, bucket);
}

function pruneExpiredBuckets(
  buckets: Map<string, AuthRateLimitBucket>,
  now: number
): void {
  for (const [key, bucket] of buckets) {
    if (bucket.windowExpiresAt <= now && bucket.blockedUntil <= now) {
      buckets.delete(key);
    }
  }
}

function deleteOldestBucket(buckets: Map<string, AuthRateLimitBucket>): void {
  const oldestKey = buckets.keys().next().value as string | undefined;
  if (oldestKey) buckets.delete(oldestKey);
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

async function createRedisAuthRateLimiter(input: {
  redisUrl: string;
  options?: Partial<AuthRateLimiterOptions>;
}): Promise<AuthRateLimiter> {
  const { createClient } = await import("redis");
  const client = createClient({ url: input.redisUrl });
  await client.connect();
  const options = { ...defaultOptions, ...input.options };

  async function check(input: AuthRateLimitInput): Promise<AuthRateLimitDecision> {
    const keys = redisKeys(input);
    const retryAfter = Math.max(
      await retryAfterForKeyMs(keys.globalBlock),
      await retryAfterForKeyMs(keys.emailBlock),
      keys.ipBlock ? await retryAfterForKeyMs(keys.ipBlock) : 0
    );
    if (retryAfter <= 0) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfter / 1000))
    };
  }

  async function reserveAttempt(input: AuthRateLimitInput): Promise<AuthRateLimitDecision> {
    const keys = redisKeys(input);
    const buckets = redisBucketSpecs(keys, options);
    const retryAfter = await runRedisScript(
      reserveAttemptScript,
      buckets.flatMap((bucket) => [
        bucket.attemptsKey,
        bucket.pendingKey,
        bucket.blockKey
      ]),
      [
        String(options.windowMs),
        String(options.blockMs),
        String(Math.min(options.windowMs, maxReservationMs)),
        String(buckets.length),
        ...buckets.map((bucket) => String(bucket.maxFailures))
      ]
    );
    const retryAfterMs = typeof retryAfter === "number" ? retryAfter : Number(retryAfter);
    return retryAfterMs > 0 ? deniedDecision(retryAfterMs) : { allowed: true };
  }

  async function releaseReservedAttempt(input: AuthRateLimitInput): Promise<void> {
    const keys = redisKeys(input);
    await releaseRedisReservations(redisBucketSpecs(keys, options));
  }

  async function recordFailure(
    input: AuthRateLimitInput,
    recordOptions: AuthRateLimitRecordOptions = {}
  ): Promise<void> {
    const keys = redisKeys(input);
    const buckets = redisBucketSpecs(keys, options);
    await Promise.all(
      buckets.map((bucket) =>
        recordRedisFailure(
          bucket.attemptsKey,
          bucket.pendingKey,
          bucket.blockKey,
          bucket.maxFailures,
          recordOptions.reserved === true
        )
      )
    );
  }

  async function recordSuccess(
    input: AuthRateLimitInput,
    recordOptions: AuthRateLimitRecordOptions = {}
  ): Promise<void> {
    const keys = redisKeys(input);
    if (recordOptions.reserved) {
      await releaseRedisReservations(redisBucketSpecs(keys, options));
    }
    await client.del([keys.emailAttempts, keys.emailPending, keys.emailBlock]);
  }

  async function retryAfterForKeyMs(key: string): Promise<number> {
    const ttl = await client.pTTL(key);
    return ttl > 0 ? ttl : 0;
  }

  async function recordRedisFailure(
    attemptsKey: string,
    pendingKey: string,
    blockKey: string,
    maxFailures: number,
    reserved: boolean
  ): Promise<void> {
    await runRedisScript(
      recordFailureScript,
      [attemptsKey, pendingKey, blockKey],
      [
        String(options.windowMs),
        String(options.blockMs),
        String(maxFailures),
        reserved ? "1" : "0"
      ]
    );
  }

  async function releaseRedisReservations(buckets: RedisBucketSpec[]): Promise<void> {
    await Promise.all(
      buckets.map((bucket) =>
        runRedisScript(releaseReservationScript, [bucket.pendingKey], [])
      )
    );
  }

  async function runRedisScript(
    script: string,
    keys: string[],
    args: string[]
  ): Promise<unknown> {
    return client.sendCommand(["EVAL", script, String(keys.length), ...keys, ...args]);
  }

  return {
    check,
    reserveAttempt,
    releaseReservedAttempt,
    recordFailure,
    recordSuccess,
    async close() {
      await client.quit();
    }
  };
}

function redisKeys(input: AuthRateLimitInput): {
  globalAttempts: string;
  globalPending: string;
  globalBlock: string;
  emailAttempts: string;
  emailPending: string;
  emailBlock: string;
  ipAttempts: string | null;
  ipPending: string | null;
  ipBlock: string | null;
} {
  const email = stableKey(normalizeEmail(input.email));
  const ip = normalizeIp(input.ip);
  const ipKey = ip ? stableKey(ip) : null;
  return {
    globalAttempts: "kiss-pm:auth-rate:global:attempts",
    globalPending: "kiss-pm:auth-rate:global:pending",
    globalBlock: "kiss-pm:auth-rate:global:block",
    emailAttempts: `kiss-pm:auth-rate:email:${email}:attempts`,
    emailPending: `kiss-pm:auth-rate:email:${email}:pending`,
    emailBlock: `kiss-pm:auth-rate:email:${email}:block`,
    ipAttempts: ipKey ? `kiss-pm:auth-rate:ip:${ipKey}:attempts` : null,
    ipPending: ipKey ? `kiss-pm:auth-rate:ip:${ipKey}:pending` : null,
    ipBlock: ipKey ? `kiss-pm:auth-rate:ip:${ipKey}:block` : null
  };
}

type RedisKeys = ReturnType<typeof redisKeys>;

type RedisBucketSpec = {
  attemptsKey: string;
  pendingKey: string;
  blockKey: string;
  maxFailures: number;
};

function redisBucketSpecs(
  keys: RedisKeys,
  options: AuthRateLimiterOptions
): RedisBucketSpec[] {
  return [
    {
      attemptsKey: keys.globalAttempts,
      pendingKey: keys.globalPending,
      blockKey: keys.globalBlock,
      maxFailures: options.maxGlobalFailures
    },
    {
      attemptsKey: keys.emailAttempts,
      pendingKey: keys.emailPending,
      blockKey: keys.emailBlock,
      maxFailures: options.maxFailures
    },
    ...(keys.ipAttempts && keys.ipPending && keys.ipBlock
      ? [{
          attemptsKey: keys.ipAttempts,
          pendingKey: keys.ipPending,
          blockKey: keys.ipBlock,
          maxFailures: options.maxFailures
        }]
      : [])
  ];
}

const reserveAttemptScript = `
local windowMs = tonumber(ARGV[1])
local blockMs = tonumber(ARGV[2])
local reservationMs = tonumber(ARGV[3])
local bucketCount = tonumber(ARGV[4])
local retryAfter = 0

for i = 1, bucketCount do
  local attemptsKey = KEYS[((i - 1) * 3) + 1]
  local pendingKey = KEYS[((i - 1) * 3) + 2]
  local blockKey = KEYS[((i - 1) * 3) + 3]
  local maxFailures = tonumber(ARGV[4 + i])
  local blockTtl = redis.call("PTTL", blockKey)
  if blockTtl > retryAfter then
    retryAfter = blockTtl
  end
  local attempts = tonumber(redis.call("GET", attemptsKey) or "0")
  local pending = tonumber(redis.call("GET", pendingKey) or "0")
  if attempts >= maxFailures then
    redis.call("SET", blockKey, "1", "PX", blockMs)
    if blockMs > retryAfter then
      retryAfter = blockMs
    end
  elseif attempts + pending >= maxFailures then
    local pendingTtl = redis.call("PTTL", pendingKey)
    if pendingTtl < 0 then
      pendingTtl = reservationMs
    end
    if pendingTtl > retryAfter then
      retryAfter = pendingTtl
    end
  end
end

if retryAfter > 0 then
  return retryAfter
end

for i = 1, bucketCount do
  local pendingKey = KEYS[((i - 1) * 3) + 2]
  local pending = redis.call("INCR", pendingKey)
  if pending == 1 then
    redis.call("PEXPIRE", pendingKey, reservationMs)
  end
end

return 0
`;

const recordFailureScript = `
local windowMs = tonumber(ARGV[1])
local blockMs = tonumber(ARGV[2])
local maxFailures = tonumber(ARGV[3])
local reserved = ARGV[4] == "1"
local attemptsKey = KEYS[1]
local pendingKey = KEYS[2]
local blockKey = KEYS[3]

if reserved then
  local pending = redis.call("DECR", pendingKey)
  if pending <= 0 then
    redis.call("DEL", pendingKey)
  end
end

local attempts = redis.call("INCR", attemptsKey)
if attempts == 1 then
  redis.call("PEXPIRE", attemptsKey, windowMs)
end
if attempts >= maxFailures then
  redis.call("SET", blockKey, "1", "PX", blockMs)
end

return attempts
`;

const releaseReservationScript = `
local pendingKey = KEYS[1]
local pending = redis.call("DECR", pendingKey)
if pending <= 0 then
  redis.call("DEL", pendingKey)
end
return 0
`;

function stableKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
