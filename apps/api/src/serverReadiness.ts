import type { PostgresClient } from "@kiss-pm/persistence";

import {
  checkStorageProviderReadWrite,
  type ReadinessChecks
} from "./healthRoutes";
import type { StorageProvider } from "./storageProvider";

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
    };
  } else if (input.production) {
    checks.database = async () => {
      throw new Error("database_not_configured");
    };
  }

  return checks;
}
