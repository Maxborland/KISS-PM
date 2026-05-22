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

  it("normalizes forwarded client IP headers", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.4, 10.0.0.10"
    });

    expect(getClientIp(headers)).toBe("198.51.100.4");
  });
});
