import { serve } from "@hono/node-server";
import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource
} from "@kiss-pm/persistence";
import { createApp, type CreateAppOptions } from "./app";
import { createDefaultBackgroundJobRegistry } from "./backgroundJobs/jobHandlers";
import {
  enqueueDueBackgroundJobSchedules,
  runBackgroundJobWorkerTick
} from "./backgroundJobs/backgroundJobWorker";
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
const readinessChecks = createServerReadinessChecks({
  planningEventsBackend: runtimeConfig.planningEventsBackend,
  postgresClient,
  production: runtimeConfig.production,
  storageProvider
});

const publisher = await bootstrapPlanningEventPublisher();
setPlanningEventPublisher(publisher);

const appOptions: CreateAppOptions = {
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

let backgroundJobsTimer: NodeJS.Timeout | undefined;
if (dataSource && runtimeConfig.backgroundJobsEnabled) {
  const registry = createDefaultBackgroundJobRegistry();
  const workerId = `api-worker-${process.pid}`;
  backgroundJobsTimer = setInterval(() => {
    void enqueueDueBackgroundJobSchedules({ dataSource })
      .then(() => runBackgroundJobWorkerTick({
        dataSource,
        registry,
        storageProvider,
        workerId
      }))
      .catch((error) => {
        console.error("background_jobs_tick_failed", error);
      });
  }, runtimeConfig.backgroundJobsPollMs);
  backgroundJobsTimer.unref();
  console.log("KISS PM background jobs worker enabled");
}

process.on("SIGTERM", () => {
  if (backgroundJobsTimer) clearInterval(backgroundJobsTimer);
  void postgresClient?.end();
});

process.on("SIGINT", () => {
  if (backgroundJobsTimer) clearInterval(backgroundJobsTimer);
  void postgresClient?.end();
});
