import { describe, expect, it } from "vitest";

import {
  assertServerRuntimeConfig,
  readServerRuntimeConfig
} from "./serverConfig";
import { createServerReadinessChecks } from "./serverReadiness";
import type { StorageProvider } from "./storageProvider";

describe("server readiness checks", () => {
  it("fails server startup configuration in production when DATABASE_URL is not configured", () => {
    expect(() =>
      assertServerRuntimeConfig({
        NODE_ENV: "production"
      } as NodeJS.ProcessEnv)
    ).toThrow("database_url_required_in_production");
  });

  it("allows production startup configuration when DATABASE_URL is configured", () => {
    expect(() =>
      assertServerRuntimeConfig({
        DATABASE_URL: "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm",
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
        PORT: "4100"
      } as NodeJS.ProcessEnv)
    ).toEqual({
      databaseUrl: undefined,
      enableDevTenantRoutes: true,
      hostname: "0.0.0.0",
      port: 4100,
      production: false
    });
    expect(readServerRuntimeConfig({} as NodeJS.ProcessEnv)).toEqual({
      databaseUrl: undefined,
      enableDevTenantRoutes: false,
      hostname: "127.0.0.1",
      port: 4000,
      production: false
    });
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
