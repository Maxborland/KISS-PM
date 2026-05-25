import type { PostgresClient } from "@kiss-pm/persistence";

import {
  checkStorageProviderReadWrite,
  type ReadinessChecks
} from "./healthRoutes";
import type { StorageProvider } from "./storageProvider";

export const expectedDatabaseMigrationTag = "0033_phase_9_closure_retrospectives.sql";

export function createServerReadinessChecks(input: {
  postgresClient?: PostgresClient | undefined;
  storageProvider: StorageProvider;
  production: boolean;
}): ReadinessChecks {
  const checks: ReadinessChecks = {
    storage: () => checkStorageProviderReadWrite(input.storageProvider)
  };

  const postgresClient = input.postgresClient;
  if (postgresClient) {
    checks.database = async () => {
      await postgresClient`select 1`;
      const rows = await postgresClient`
        select 1
        from kiss_pm_migrations
        where tag = ${expectedDatabaseMigrationTag}
        limit 1
      `;
      if (rows.length !== 1) {
        throw new Error("database_schema_not_ready");
      }
    };
  } else if (input.production) {
    checks.database = async () => {
      throw new Error("database_not_configured");
    };
  }

  return checks;
}
