import { serve } from "@hono/node-server";
import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource
} from "@kiss-pm/persistence";
import { createApp, type CreateAppOptions } from "./app";
import { bootstrapPlanningEventPublisher, setPlanningEventPublisher } from "./planningEventBus";
import { assertServerRuntimeConfig } from "./serverConfig";
import { createServerReadinessChecks } from "./serverReadiness";
import { createStorageProviderFromEnv } from "./storageProvider";

assertServerRuntimeConfig();

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const hostname = process.env.HOST ?? "127.0.0.1";
const databaseUrl = process.env.DATABASE_URL;
const postgresClient = databaseUrl
  ? createPostgresClient(databaseUrl)
  : undefined;
const dataSource = postgresClient
  ? createPostgresTenantDataSource(createDatabase(postgresClient))
  : undefined;
const enableDevTenantRoutes = process.env.KISS_PM_ENABLE_DEV_ROUTES === "true";
const storageProvider = createStorageProviderFromEnv();
const readinessChecks = createServerReadinessChecks({
  postgresClient,
  production: process.env.NODE_ENV === "production",
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

serve({
  fetch: createApp(appOptions).fetch,
  hostname,
  port
});

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
