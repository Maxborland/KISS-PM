import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

// Fail-closed: DATABASE_URL обязателен. В production подстановка dev-дефолта со
// слабым паролем запрещена — иначе миграции могут молча уйти не в ту БД или под
// заведомо скомпрометированными кредами. Dev-удобство сохранено: локальный дефолт
// разрешён ТОЛЬКО когда NODE_ENV !== "production".
const defaultDatabaseUrl =
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

function resolveDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is required to run migrations in production. " +
        "Refusing to fall back to the built-in dev credentials."
    );
  }

  console.warn(
    "DATABASE_URL is not set; using the local development database default. " +
      "Set DATABASE_URL explicitly for any non-local environment."
  );
  return defaultDatabaseUrl;
}

const databaseUrl = resolveDatabaseUrl();
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
