import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const defaultDatabaseUrl =
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(scriptDir, "..", "migrations");
const client = postgres(databaseUrl, { max: 1, onnotice: () => {}, prepare: false });

try {
  await client`
    CREATE TABLE IF NOT EXISTS kiss_pm_migrations (
      tag text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = await client`SELECT tag FROM kiss_pm_migrations`;
  const applied = new Set(appliedRows.map((row) => row.tag));
  const migrationFiles = readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    if (applied.has(fileName)) {
      continue;
    }

    const migrationSql = readFileSync(join(migrationsDir, fileName), "utf8");
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    await client.begin(async (transaction) => {
      for (const statement of statements) {
        await transaction.unsafe(statement);
      }

      await transaction`
        INSERT INTO kiss_pm_migrations (tag)
        VALUES (${fileName})
      `;
    });

    console.log(`Applied migration ${fileName}`);
  }

  if (migrationFiles.every((fileName) => applied.has(fileName))) {
    console.log("No pending migrations");
  }
} finally {
  await client.end();
}
