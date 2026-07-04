import { describe, expect, it } from "vitest";

import {
  assertServerRuntimeConfig,
  readServerRuntimeConfig
} from "./serverConfig";
import { setPlanningRealtimeStatusProvider } from "./planningRealtimeHealth";
import { createServerReadinessChecks } from "./serverReadiness";
import { createEmailProviderFromEnv, readEmailProviderRuntimeConfig } from "./emailProvider";
import type { StorageProvider } from "./storageProvider";

describe("server readiness checks", () => {
  it("fails server startup configuration in production when DATABASE_URL is not configured", () => {
    expect(() =>
      assertServerRuntimeConfig({
        NODE_ENV: "production"
      } as NodeJS.ProcessEnv)
    ).toThrow("database_url_required_in_production");
  });

  it("fails production startup configuration when SMTP email delivery is not configured", () => {
    expect(() =>
      assertServerRuntimeConfig({
        DATABASE_URL: "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm",
        NODE_ENV: "production"
      } as NodeJS.ProcessEnv)
    ).toThrow("kiss_pm_smtp_host_required");
  });

  it("allows production startup configuration when DATABASE_URL and SMTP are configured", () => {
    expect(() =>
      assertServerRuntimeConfig({
        DATABASE_URL: "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm",
        KISS_PM_SMTP_FROM: "KISS PM <noreply@example.com>",
        KISS_PM_SMTP_HOST: "smtp.example.com",
        NODE_ENV: "production"
      } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it("fails production startup configuration when dev tenant routes are enabled", () => {
    expect(() =>
      assertServerRuntimeConfig({
        DATABASE_URL: "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm",
        KISS_PM_ENABLE_DEV_ROUTES: "true",
        NODE_ENV: "production"
      } as NodeJS.ProcessEnv)
    ).toThrow("dev_routes_forbidden_in_production");
  });

  it("fails startup configuration for invalid or incomplete planning event backend", () => {
    expect(() =>
      readServerRuntimeConfig({
        PLANNING_EVENTS_BACKEND: "postgres"
      } as NodeJS.ProcessEnv)
    ).toThrow("invalid_planning_events_backend");
    expect(() =>
      readServerRuntimeConfig({
        PLANNING_EVENTS_BACKEND: "redis"
      } as NodeJS.ProcessEnv)
    ).toThrow("planning_events_redis_url_required");
    expect(() =>
      readServerRuntimeConfig({
        DATABASE_URL: "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm",
        NODE_ENV: "production",
        PLANNING_EVENTS_BACKEND: "redis",
        PLANNING_EVENTS_REDIS_URL: "redis://cache.internal:6379"
      } as NodeJS.ProcessEnv)
    ).toThrow("redis_url_insecure_in_production");
  });

  it("selects in-memory email provider outside production and forbids it in production", () => {
    expect(readEmailProviderRuntimeConfig({} as NodeJS.ProcessEnv)).toEqual({ provider: "memory" });
    expect(createEmailProviderFromEnv({} as NodeJS.ProcessEnv)).toMatchObject({
      provider: "memory",
      lastPasswordReset: null
    });
    expect(() =>
      readEmailProviderRuntimeConfig({
        KISS_PM_EMAIL_PROVIDER: "memory",
        NODE_ENV: "production"
      } as NodeJS.ProcessEnv)
    ).toThrow("email_provider_memory_forbidden_in_production");
  });

  it("parses SMTP email provider configuration", () => {
    expect(
      readEmailProviderRuntimeConfig({
        KISS_PM_EMAIL_PROVIDER: "smtp",
        KISS_PM_SMTP_FROM: "KISS PM <noreply@example.com>",
        KISS_PM_SMTP_HOST: "smtp.example.com",
        KISS_PM_SMTP_PASSWORD: "secret",
        KISS_PM_SMTP_PORT: "2525",
        KISS_PM_SMTP_USERNAME: "apikey"
      } as NodeJS.ProcessEnv)
    ).toMatchObject({
      provider: "smtp",
      host: "smtp.example.com",
      port: 2525,
      envelopeFrom: "noreply@example.com",
      username: "apikey"
    });
    expect(createEmailProviderFromEnv({
      KISS_PM_EMAIL_PROVIDER: "smtp",
      KISS_PM_SMTP_FROM: "noreply@example.com",
      KISS_PM_SMTP_HOST: "smtp.example.com"
    } as NodeJS.ProcessEnv)).toMatchObject({ provider: "smtp" });
  });
  it("rejects malformed server port and host configuration", () => {
    expect(() =>
      readServerRuntimeConfig({
        PORT: "4000abc"
      } as NodeJS.ProcessEnv)
    ).toThrow("invalid_server_port");
    expect(() =>
      readServerRuntimeConfig({
        PORT: "0"
      } as NodeJS.ProcessEnv)
    ).toThrow("invalid_server_port");
    expect(() =>
      readServerRuntimeConfig({
        HOST: "http://127.0.0.1"
      } as NodeJS.ProcessEnv)
    ).toThrow("invalid_server_host");
    expect(() =>
      readServerRuntimeConfig({
        HOST: "127.0.0.1/unsafe"
      } as NodeJS.ProcessEnv)
    ).toThrow("invalid_server_host");
  });

  it("normalizes server startup runtime configuration", () => {
    expect(
      readServerRuntimeConfig({
        HOST: "0.0.0.0",
        KISS_PM_ENABLE_DEV_ROUTES: "true",
        PLANNING_EVENTS_BACKEND: "redis",
        PLANNING_EVENTS_REDIS_URL: "redis://127.0.0.1:6379",
        PORT: "4100"
      } as NodeJS.ProcessEnv)
    ).toEqual({
      backgroundJobsEnabled: false,
      backgroundJobsPollMs: 10_000,
      databaseUrl: undefined,
      enableDevTenantRoutes: true,
      hostname: "0.0.0.0",
      planningEventsBackend: "redis",
      planningEventsRedisUrl: "redis://127.0.0.1:6379",
      port: 4100,
      production: false,
      videoProvider: undefined,
      mediaReadinessUrl: undefined
    });
    expect(readServerRuntimeConfig({} as NodeJS.ProcessEnv)).toEqual({
      backgroundJobsEnabled: false,
      backgroundJobsPollMs: 10_000,
      databaseUrl: undefined,
      enableDevTenantRoutes: false,
      hostname: "127.0.0.1",
      planningEventsBackend: "memory",
      planningEventsRedisUrl: undefined,
      port: 4000,
      production: false,
      videoProvider: undefined,
      mediaReadinessUrl: undefined
    });
  });

  it("normalizes and bounds background job worker runtime configuration", () => {
    expect(readServerRuntimeConfig({
      KISS_PM_BACKGROUND_JOBS_ENABLED: "true",
      KISS_PM_BACKGROUND_JOBS_POLL_MS: "15000"
    } as NodeJS.ProcessEnv)).toMatchObject({
      backgroundJobsEnabled: true,
      backgroundJobsPollMs: 15_000
    });
    expect(() =>
      readServerRuntimeConfig({
        KISS_PM_BACKGROUND_JOBS_POLL_MS: "50"
      } as NodeJS.ProcessEnv)
    ).toThrow("invalid_background_jobs_poll_ms");
  });

  it("fails database readiness in production when DATABASE_URL is not configured", async () => {
    const checks = createServerReadinessChecks({
      production: true,
      storageProvider: fakeStorageProvider()
    });

    await expect(checks.database?.()).rejects.toThrow("database_not_configured");
  });

  it("allows database readiness to be omitted in local development", () => {
    const checks = createServerReadinessChecks({
      production: false,
      storageProvider: fakeStorageProvider()
    });

    expect(checks.database).toBeUndefined();
  });

  it("checks that the expected database migration was applied", async () => {
    const checks = createServerReadinessChecks({
      postgresClient: fakePostgresClient([[{ ready: 1 }], [{ ready: 1 }]]),
      production: true,
      storageProvider: fakeStorageProvider()
    });

    await expect(checks.database?.()).resolves.toBeUndefined();
  });

  it("fails database readiness when schema migrations are missing", async () => {
    const checks = createServerReadinessChecks({
      postgresClient: fakePostgresClient([[{ ready: 1 }], []]),
      production: true,
      storageProvider: fakeStorageProvider()
    });

    await expect(checks.database?.()).rejects.toThrow("database_schema_not_ready");
  });

  it("adds realtime readiness only when Redis planning events are enabled", async () => {
    setPlanningRealtimeStatusProvider(() => ({
      backend: "redis",
      connected: true,
      redisConfigured: true
    }));
    const redisChecks = createServerReadinessChecks({
      planningEventsBackend: "redis",
      production: true,
      storageProvider: fakeStorageProvider()
    });
    const memoryChecks = createServerReadinessChecks({
      planningEventsBackend: "memory",
      production: true,
      storageProvider: fakeStorageProvider()
    });

    expect(redisChecks.realtime).toBeTypeOf("function");
    expect(redisChecks.realtime?.()).toBeUndefined();
    expect(memoryChecks.realtime).toBeUndefined();
  });

  it("fails realtime readiness when Redis planning events are configured but disconnected", async () => {
    setPlanningRealtimeStatusProvider(() => ({
      backend: "memory",
      connected: false,
      redisConfigured: true
    }));
    const checks = createServerReadinessChecks({
      planningEventsBackend: "redis",
      production: true,
      storageProvider: fakeStorageProvider()
    });

    expect(() => checks.realtime?.()).toThrow("planning_realtime_not_ready");
  });
});

function fakeStorageProvider(): StorageProvider {
  return {
    provider: "local",
    async putObject() {},
    async readObject() {
      return {
        bytes: new Uint8Array(),
        mimeType: "application/octet-stream",
        safeDisplayName: "health.txt"
      };
    },
    async deleteObject() {},
    getSafeDownloadName() {
      return "health.txt";
    }
  };
}

function fakePostgresClient(results: unknown[][]) {
  let index = 0;
  return async () => results[index++] ?? [];
}
