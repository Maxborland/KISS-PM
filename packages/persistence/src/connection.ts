import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type PostgresClient = ReturnType<typeof postgres>;

export function createPostgresClient(databaseUrl: string): PostgresClient {
  return postgres(databaseUrl, {
    max: 5,
    prepare: false,
    // NOTICE-класс (truncate cascade и т.п.) заваливал логи db-тестов мегабайтами
    // шума, за которым не видно падений; на боевых коннектах он тоже не нужен.
    connection: { client_min_messages: "warning" }
  });
}

export function createDatabase(client: PostgresClient) {
  return drizzle(client, { schema });
}

export type KissPmDatabase = ReturnType<typeof createDatabase>;
