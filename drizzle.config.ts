import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/persistence/src/schema.ts",
  out: "./packages/persistence/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://127.0.0.1:5432/kiss_pm"
  }
});
