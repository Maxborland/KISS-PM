import { describe, expect, it } from "vitest";
import type { PostgresClient } from "@kiss-pm/persistence";

import { assertServerRuntimeConfig } from "./serverConfig";
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
        DATABASE_URL: "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm",
        NODE_ENV: "production"
      } as NodeJS.ProcessEnv)
    ).not.toThrow();
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

function fakePostgresClient(results: unknown[][]): PostgresClient {
  let index = 0;
  return (async () => results[index++] ?? []) as unknown as PostgresClient;
}
