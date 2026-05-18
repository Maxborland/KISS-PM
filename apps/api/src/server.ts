import { serve } from "@hono/node-server";
import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource
} from "@kiss-pm/persistence";
import { createApp } from "./app";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const hostname = process.env.HOST ?? "127.0.0.1";
const databaseUrl = process.env.DATABASE_URL;
const postgresClient = databaseUrl
  ? createPostgresClient(databaseUrl)
  : undefined;
const dataSource = postgresClient
  ? createPostgresTenantDataSource(createDatabase(postgresClient))
  : undefined;

serve({
  fetch: (dataSource ? createApp({ dataSource }) : createApp()).fetch,
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
