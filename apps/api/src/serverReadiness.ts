import {
  checkStorageProviderReadWrite,
  type ReadinessChecks
} from "./healthRoutes";
import { getPlanningRealtimeStatus } from "./planningRealtimeHealth";
import type { PlanningEventsBackend } from "./serverConfig";
import type { StorageProvider } from "./storageProvider";

export const expectedDatabaseMigrationTag = "0043_project_resource_pool_members.sql";

type ReadinessPostgresClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => unknown;

export function createServerReadinessChecks(input: {
  postgresClient?: ReadinessPostgresClient | undefined;
  planningEventsBackend?: PlanningEventsBackend | undefined;
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
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new Error("database_schema_not_ready");
      }
    };
  } else if (input.production) {
    checks.database = async () => {
      throw new Error("database_not_configured");
    };
  }

  if (input.planningEventsBackend === "redis") {
    checks.realtime = () => {
      const status = getPlanningRealtimeStatus();
      if (status.backend !== "redis" || !status.connected || !status.redisConfigured) {
        throw new Error("planning_realtime_not_ready");
      }
    };
  }

  return checks;
}
