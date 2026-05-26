import { serve } from "@hono/node-server";
import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource
} from "@kiss-pm/persistence";
import { createApp, type CreateAppOptions } from "./app";
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

process.on("SIGTERM", () => {
  void postgresClient?.end();
});

process.on("SIGINT", () => {
  void postgresClient?.end();
});
