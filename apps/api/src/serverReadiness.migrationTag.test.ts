import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { expectedDatabaseMigrationTag } from "./serverReadiness";

/**
 * Guard: readiness-тег обязан совпадать с последним файлом миграций — раннер
 * сортирует их по имени, /health/ready сравнивает применённый тег с ожидаемым.
 * Без этого теста тег протухает молча (застревал на 0043 при миграциях до 0055),
 * и readiness отдаёт READY на базе без свежих миграций.
 */
describe("serverReadiness: expectedDatabaseMigrationTag", () => {
  it("совпадает с последней миграцией в packages/persistence/migrations", () => {
    const migrationsDir = path.resolve(__dirname, "../../../packages/persistence/migrations");
    const latest = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .at(-1);
    expect(latest).toBeDefined();
    expect(expectedDatabaseMigrationTag).toBe(latest);
  });
});
