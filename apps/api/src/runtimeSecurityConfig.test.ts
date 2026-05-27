import { describe, expect, it } from "vitest";

import {
  readRuntimeSecurityConfig,
  readSecureCookiePolicy,
  readSecureRedisPolicy
} from "./runtimeSecurityConfig";

describe("runtime security config", () => {
  it("normalizes secure cookie and Redis policy through one module", () => {
    const config = readRuntimeSecurityConfig({
      NODE_ENV: "production",
      KISS_PM_SECURE_COOKIES: "true",
      PLANNING_EVENTS_REDIS_URL: "rediss://redis.internal:6379"
    });

    expect(config).toEqual({
      production: true,
      secureCookies: true,
      planningEventsRedisUrl: "rediss://redis.internal:6379"
    });
  });

  it("rejects production insecure cookie and Redis settings", () => {
    expect(() => readSecureCookiePolicy({
      NODE_ENV: "production",
      KISS_PM_SECURE_COOKIES: "false"
    })).toThrow("secure_cookies_required_in_production");
    expect(() => readSecureRedisPolicy({
      production: true,
      url: "redis://redis.internal:6379"
    })).toThrow("redis_url_insecure_in_production");
  });
});
