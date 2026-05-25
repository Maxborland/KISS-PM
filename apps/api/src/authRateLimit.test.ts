import { describe, expect, it } from "vitest";
import { createAuthRateLimiter, getClientIp } from "./authRateLimit";

describe("auth rate limiter", () => {
  it("blocks repeated failed attempts for the same email and IP", () => {
    const limiter = createAuthRateLimiter({
      maxFailures: 2,
      windowMs: 60_000,
      blockMs: 30_000
    });
    const input = {
      email: "Admin@KISS-PM.local",
      ip: "203.0.113.10",
      now: 1_000
    };

    expect(limiter.check(input)).toEqual({ allowed: true });
    limiter.recordFailure(input);
    expect(limiter.check({ ...input, now: 2_000 })).toEqual({ allowed: true });
    limiter.recordFailure({ ...input, now: 2_000 });

    expect(limiter.check({ ...input, now: 3_000 })).toEqual({
      allowed: false,
      retryAfterSeconds: 29
    });
  });

  it("ignores forwarded client IP headers unless they are explicitly trusted", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.5",
      "x-forwarded-for": "198.51.100.4, 10.0.0.10"
    });

    expect(getClientIp(headers)).toBeNull();
    expect(getClientIp(headers, { trustForwardedHeaders: true })).toBe("198.51.100.5");
  });

  it("does not place clients without a known IP into one shared throttle bucket", () => {
    const limiter = createAuthRateLimiter({
      maxFailures: 2,
      maxGlobalFailures: 100,
      windowMs: 60_000,
      blockMs: 30_000
    });
    expect(getClientIp(new Headers())).toBeNull();

    limiter.recordFailure({ email: "one@kiss-pm.local", ip: null, now: 1_000 });
    limiter.recordFailure({ email: "one@kiss-pm.local", ip: null, now: 2_000 });

    expect(
      limiter.check({ email: "two@kiss-pm.local", ip: null, now: 3_000 })
    ).toEqual({ allowed: true });
    expect(
      limiter.check({ email: "one@kiss-pm.local", ip: null, now: 3_000 })
    ).toEqual({
      allowed: false,
      retryAfterSeconds: 29
    });
  });

  it("blocks broad random-email login sprays through a global failure bucket", () => {
    const limiter = createAuthRateLimiter({
      maxFailures: 10,
      maxGlobalFailures: 3,
      windowMs: 60_000,
      blockMs: 30_000
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const input = {
        email: `spray-${attempt}@kiss-pm.local`,
        ip: null,
        now: 1_000 + attempt * 1_000
      };
      expect(limiter.check(input)).toEqual({ allowed: true });
      limiter.recordFailure(input);
    }

    expect(
      limiter.check({
        email: "fresh-random-email@kiss-pm.local",
        ip: null,
        now: 4_000
      })
    ).toEqual({
      allowed: false,
      retryAfterSeconds: 29
    });
  });

  it("bounds tracked email buckets to avoid unbounded memory growth", () => {
    const limiter = createAuthRateLimiter({
      maxFailures: 2,
      maxGlobalFailures: 100,
      maxTrackedEmails: 1,
      windowMs: 60_000,
      blockMs: 30_000
    });

    limiter.recordFailure({
      email: "first@kiss-pm.local",
      ip: null,
      now: 1_000
    });
    limiter.recordFailure({
      email: "second@kiss-pm.local",
      ip: null,
      now: 2_000
    });

    expect(
      limiter.check({
        email: "first@kiss-pm.local",
        ip: null,
        now: 3_000
      })
    ).toEqual({ allowed: true });
  });
});
