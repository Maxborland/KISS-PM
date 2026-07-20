import { readFileSync } from "node:fs";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { userNotifications } from "./index";

const deliveredAtMigration = readFileSync(
  new URL("../migrations/0056_notification_delivered_at.sql", import.meta.url),
  "utf8"
);

// user_notifications — самая горячая таблица инсталляции (пишется на каждое
// упоминание, читается на каждом открытии колокольчика), а scripts/migrate.mjs
// выполняет весь файл миграции в ОДНОЙ транзакции. Значит любая операция,
// переписывающая строки, держит ACCESS EXCLUSIVE до COMMIT и на миллионах
// уведомлений блокирует и чтение, и запись на минуты.
describe("миграция 0056: маркер offline-доставки", () => {
  it("не переписывает таблицу backfill'ом: UPDATE по всем строкам запрещён", () => {
    const statements = deliveredAtMigration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    expect(statements).not.toMatch(/update\s+user_notifications/i);
    expect(statements).not.toMatch(/set\s+delivered_at\s*=\s*created_at/i);
  });

  it("исторический хвост размечается быстрым DEFAULT, а новые строки остаются NULL", () => {
    // ADD COLUMN с константным DEFAULT (PostgreSQL 11+) пишет значение только в
    // каталог: существующие строки читаются как уже вручённые без единой
    // переписанной страницы.
    expect(deliveredAtMigration).toMatch(
      /add column delivered_at timestamptz default '-infinity'/i
    );
    // DEFAULT снимается сразу, иначе новые уведомления рождались бы уже
    // «вручёнными» и письма не уходили бы никогда.
    expect(deliveredAtMigration).toMatch(
      /alter column delivered_at drop default/i
    );
    const addDefaultAt = deliveredAtMigration.search(/add column delivered_at/i);
    const dropDefaultAt = deliveredAtMigration.search(/drop default/i);
    expect(addDefaultAt).toBeGreaterThanOrEqual(0);
    expect(dropDefaultAt).toBeGreaterThan(addDefaultAt);
  });

  it("счётчик попыток добавляется константным DEFAULT (тоже без переписывания)", () => {
    expect(deliveredAtMigration).toMatch(
      /add column delivery_attempts integer not null default 0/i
    );
  });

  it("индекс очереди — частичный: в нём только ожидающие доставки строки", () => {
    expect(deliveredAtMigration).toMatch(
      /create index if not exists user_notifications_tenant_pending_delivery_idx[\s\S]*?where delivered_at is null/i
    );
  });
});

describe("схема user_notifications: очередь offline-доставки", () => {
  it("держит счётчик попыток с дефолтом 0", () => {
    const columns = getTableConfig(userNotifications).columns;
    const attempts = columns.find((column) => column.name === "delivery_attempts");
    expect(attempts).toBeDefined();
    expect(attempts!.notNull).toBe(true);
    expect(attempts!.default).toBe(0);
  });

  it("индекс очереди объявлен частичным и совпадает с миграцией", () => {
    const pendingIndex = getTableConfig(userNotifications).indexes.find(
      (index) => index.config.name === "user_notifications_tenant_pending_delivery_idx"
    );
    expect(pendingIndex).toBeDefined();
    expect(pendingIndex!.config.where).toBeDefined();
    expect(pendingIndex!.config.columns.map((column) => (column as { name: string }).name)).toEqual(
      ["tenant_id", "created_at", "id"]
    );
  });
});
