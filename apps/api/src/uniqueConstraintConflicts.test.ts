/* ============================================================
   Регрессия: обход error.cause для SQLSTATE 23505 существует в ОДНОМ месте.

   Раньше идентичный обход дублировался по маршрутам; последняя копия жила в
   projectLifecycleGuards.isProjectIdConflict. Пока копий больше одной, правка
   обхода (новая глубина, новое поле с именем индекса) чинит только часть путей,
   а остальные тихо возвращаются к необработанному 500.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { isProjectIdConflict as guardsIsProjectIdConflict } from "./project-work/projectLifecycleGuards";
import {
  isCredentialEmailConflict,
  isProjectIdConflict,
  workspaceUserUniqueConflict
} from "./uniqueConstraintConflicts";

describe("распознавание конфликтов уникальности", () => {
  it("projectLifecycleGuards переиспользует общий helper, а не свою копию обхода", () => {
    expect(guardsIsProjectIdConflict).toBe(isProjectIdConflict);
  });

  it("находит projects_pkey на разной глубине error.cause", () => {
    expect(isProjectIdConflict(Object.assign(new Error("insert"), {
      code: "23505",
      constraint: "projects_pkey"
    }))).toBe(true);

    // Драйвер прячет исходную ошибку в обёртках — обход обязан дойти до неё.
    const nested = new Error("query failed", {
      cause: new Error("driver", {
        cause: Object.assign(new Error("pg"), { code: "23505", constraint: "projects_pkey" })
      })
    });
    expect(isProjectIdConflict(nested)).toBe(true);

    // Имя индекса может приехать только в message.
    expect(isProjectIdConflict({
      code: "23505",
      message: 'duplicate key value violates unique constraint "projects_pkey"'
    })).toBe(true);
  });

  it("не путает чужие индексы и не-23505 ошибки", () => {
    expect(isProjectIdConflict(new Error("connection_lost"))).toBe(false);
    expect(isProjectIdConflict({ code: "23503", constraint: "projects_pkey" })).toBe(false);
    expect(isProjectIdConflict({ code: "23505", constraint: "tenant_users_pkey" })).toBe(false);
    expect(isCredentialEmailConflict({ code: "23505", constraint: "projects_pkey" })).toBe(false);
    expect(workspaceUserUniqueConflict({ code: "23505", constraint: "projects_pkey" })).toBeNull();
  });

  it("не зацикливается на кольцевой цепочке cause", () => {
    const looped: { code: string; cause?: unknown } = { code: "42P01" };
    looped.cause = looped;
    expect(isProjectIdConflict(looped)).toBe(false);
  });
});
