import {
  checkStorageProviderReadWrite,
  type ReadinessChecks
} from "./healthRoutes";
import { getPlanningRealtimeStatus } from "./planningRealtimeHealth";
import type { PlanningEventsBackend } from "./serverConfig";
import type { StorageProvider } from "./storageProvider";

export const expectedDatabaseMigrationTag = "0042_phase_g4_recording_jobs.sql";

type ReadinessPostgresClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => unknown;

export function createServerReadinessChecks(input: {
  postgresClient?: ReadinessPostgresClient | undefined;
  planningEventsBackend?: PlanningEventsBackend | undefined;
  storageProvider: StorageProvider;
  production: boolean;
  videoProvider?: string | undefined;
  mediaReadinessUrl?: string | undefined;
  mediaReadinessTimeoutMs?: number | undefined;
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

  // Self-hosted LiveKit media plane: cheap liveness probe of the SFU HTTP endpoint.
  // Gated on the configured provider + an explicit probe URL; no secrets are ever sent.
  if (input.videoProvider === "livekit" && input.mediaReadinessUrl) {
    const mediaReadinessUrl = input.mediaReadinessUrl;
    const timeoutMs = input.mediaReadinessTimeoutMs ?? 2000;
    checks.media = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(mediaReadinessUrl, {
          method: "GET",
          signal: controller.signal
        });
        // LiveKit's HTTP root returns 200 "OK"; twirp/api paths answer 404 on GET.
        // Either proves the SFU process is listening; anything else is unhealthy.
        if (!response.ok && response.status !== 404) {
          throw new Error("media_not_ready");
        }
      } finally {
        clearTimeout(timer);
      }
    };
  }

  return checks;
}
