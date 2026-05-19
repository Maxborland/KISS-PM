import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type PostgresClient = ReturnType<typeof postgres>;

export function createPostgresClient(databaseUrl: string): PostgresClient {
  return postgres(databaseUrl, {
    max: 5,
    prepare: false
  });
}

export function createDatabase(client: PostgresClient) {
  return drizzle(client, { schema });
}

export type KissPmDatabase = ReturnType<typeof createDatabase>;
