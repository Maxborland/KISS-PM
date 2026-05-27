import { serve } from "@hono/node-server";
import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource
} from "@kiss-pm/persistence";
import { createApp, type CreateAppOptions } from "./app";
import { createAuthRateLimiterFromEnv } from "./authRateLimit";
import { bootstrapPlanningEventPublisher, setPlanningEventPublisher } from "./planningEventBus";
import { readServerRuntimeConfig } from "./serverConfig";
import { createServerReadinessChecks } from "./serverReadiness";
import {
  configureHttpServerSecurity,
  isConfigurableHttpServer
} from "./serverSecurity";
import { createStorageProviderFromEnv } from "./storageProvider";

const runtimeConfig = readServerRuntimeConfig();
const { port, hostname } = runtimeConfig;
const databaseUrl = runtimeConfig.databaseUrl;
const postgresClient = databaseUrl
  ? createPostgresClient(databaseUrl)
  : undefined;
const dataSource = postgresClient
  ? createPostgresTenantDataSource(createDatabase(postgresClient))
  : undefined;
const enableDevTenantRoutes = runtimeConfig.enableDevTenantRoutes;
const storageProvider = createStorageProviderFromEnv();
const authRateLimiter = await createAuthRateLimiterFromEnv();
const readinessChecks = createServerReadinessChecks({
  planningEventsBackend: runtimeConfig.planningEventsBackend,
  postgresClient,
  production: runtimeConfig.production,
  storageProvider
});

const publisher = await bootstrapPlanningEventPublisher();
setPlanningEventPublisher(publisher);

const appOptions: CreateAppOptions = {
  authRateLimiter,
  enableDevTenantRoutes,
  readinessChecks,
  storageProvider
};
if (dataSource) {
  appOptions.dataSource = dataSource;
}

const server = serve({
  fetch: createApp(appOptions).fetch,
  hostname,
  port
});
if (isConfigurableHttpServer(server)) {
  configureHttpServerSecurity(server);
}

console.log(`KISS PM API listening on http://${hostname}:${port}`);

if (postgresClient) {
  console.log("KISS PM API uses PostgreSQL persistence runtime");
}

let shutdownStarted = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`KISS PM API shutting down after ${signal}`);
  const forcedExit = setTimeout(() => {
    console.error("KISS PM API forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  try {
    await closeHttpServer(server);
    await Promise.allSettled([
      publisher.close?.() ?? Promise.resolve(),
      authRateLimiter.close?.() ?? Promise.resolve(),
      postgresClient?.end() ?? Promise.resolve()
    ]);
    clearTimeout(forcedExit);
    process.exit(0);
  } catch (error) {
    clearTimeout(forcedExit);
    console.error("KISS PM API shutdown failed", error);
    process.exit(1);
  }
}

function closeHttpServer(server: unknown): Promise<void> {
  type ClosableServer = {
    close(callback: (error?: Error) => void): void;
  };
  if (
    !server ||
    typeof server !== "object" ||
    !("close" in server) ||
    typeof server.close !== "function"
  ) {
    return Promise.resolve();
  }
  const closable = server as ClosableServer;

  return new Promise((resolve, reject) => {
    closable.close((error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
