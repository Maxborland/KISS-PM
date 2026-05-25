import { randomUUID } from "node:crypto";

import type { StorageProvider } from "./storageProvider";
import type { ApiApp } from "./routeTypes";

export type ReadinessCheckName = "database" | "storage";
export type ReadinessCheck = () => Promise<void> | void;
export type ReadinessChecks = Partial<Record<ReadinessCheckName, ReadinessCheck>>;

type HealthRouteDeps = {
  readinessChecks?: ReadinessChecks | undefined;
  storageProvider: StorageProvider;
};

type ReadinessCheckResponse =
  | {
      status: "ok";
      provider?: string;
      mode?: string;
    }
  | {
      status: "error";
      error: string;
      provider?: string;
    };

export function registerHealthRoutes(app: ApiApp, deps: HealthRouteDeps) {
  app.get("/health", (context) => {
    return context.json({ status: "ok", product: "KISS PM" });
  });

  app.get("/health/live", (context) => {
    return context.json({ status: "live", product: "KISS PM" });
  });

  app.get("/api/health/live", (context) => {
    return context.json({ status: "live", product: "KISS PM" });
  });

  app.get("/health/ready", async (context) => {
    const readiness = await resolveReadiness(deps);
    return context.json(readiness.body, readiness.status);
  });

  app.get("/api/health/ready", async (context) => {
    const readiness = await resolveReadiness(deps);
    return context.json(readiness.body, readiness.status);
  });
}

export async function checkStorageProviderReadWrite(
  storageProvider: StorageProvider
): Promise<void> {
  const storageKey = `.health/${randomUUID()}.txt`;
  const bytes = new TextEncoder().encode("ok");

  await storageProvider.putObject({
    bytes,
    mimeType: "text/plain",
    storageKey
  });

  try {
    await storageProvider.readObject(storageKey);
  } finally {
    await storageProvider.deleteObject(storageKey);
  }
}

async function resolveReadiness(deps: HealthRouteDeps): Promise<{
  status: 200 | 503;
  body: {
    status: "ready" | "not_ready";
    product: "KISS PM";
    checks: Record<ReadinessCheckName, ReadinessCheckResponse>;
  };
}> {
  const checks: Record<ReadinessCheckName, ReadinessCheckResponse> = {
    database: await runCheck("database", deps.readinessChecks?.database),
    storage: await runCheck("storage", deps.readinessChecks?.storage, {
      provider: deps.storageProvider.provider
    })
  };
  const ready = Object.values(checks).every((check) => check.status === "ok");

  return {
    status: ready ? 200 : 503,
    body: {
      status: ready ? "ready" : "not_ready",
      product: "KISS PM",
      checks
    }
  };
}

async function runCheck(
  name: ReadinessCheckName,
  check: ReadinessCheck | undefined,
  metadata: { provider?: string } = {}
): Promise<ReadinessCheckResponse> {
  if (!check) {
    return {
      status: "ok",
      ...metadata,
      mode: "not_configured"
    };
  }

  try {
    await check();
    return {
      status: "ok",
      ...metadata
    };
  } catch {
    return {
      status: "error",
      ...metadata,
      error: `${name}_unavailable`
    };
  }
}
