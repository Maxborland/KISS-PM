import { describe, expect, it } from "vitest";

import { mapPlanningError, planningErr } from "./project-chrome";

const cases = [
  ["session_required", 401, "Сессия истекла. Войдите снова, чтобы продолжить"],
  ["unauthorized", 401, "Сессия истекла. Войдите снова, чтобы продолжить"],
  ["permission_missing", 403, "Недостаточно прав для работы с планом проекта"],
  ["forbidden", 403, "Недостаточно прав для работы с планом проекта"],
  ["project_not_found", 404, "Проект не найден: возможно, он удалён или ссылка устарела"],
  ["plan_version_conflict", 409, "План уже изменился. Данные обновлены, повторите действие"],
  ["planning_precondition_failed", 409, "Изменение нельзя применить к текущему состоянию плана"],
  ["idempotency_key_conflict", 409, "Операция конфликтует с уже отправленным запросом. Повторите действие"],
  ["planning_scenario_invalid", 409, "Предложение повреждено или устарело — запросите сценарии заново"],
  ["persistence_not_configured", 501, "Сервис планирования временно недоступен"],
  ["network_error", 0, "Не удалось связаться с сервисом планирования. Проверьте подключение и повторите"]
] as const;

describe("mapPlanningError", () => {
  it.each(cases)("maps %s/%i and preserves its machine metadata", (code, status, message) => {
    expect(mapPlanningError({ code, status })).toEqual({ code, status, message });
    expect(planningErr(code)).toBe(message);
  });

  it.each([
    [401, "session_required", "Сессия истекла. Войдите снова, чтобы продолжить"],
    [403, "permission_missing", "Недостаточно прав для работы с планом проекта"],
    [404, "project_not_found", "Проект не найден: возможно, он удалён или ссылка устарела"],
    [409, "conflict", "План или операция уже изменились. Обновите данные и повторите действие"],
    [501, "persistence_not_configured", "Сервис планирования временно недоступен"]
  ] as const)("falls back from HTTP %i to %s", (status, code, message) => {
    expect(mapPlanningError({ status })).toEqual({ code, status, message });
  });

  it.each([
    [401, "Сессия истекла. Войдите снова, чтобы продолжить"],
    [403, "Недостаточно прав для работы с планом проекта"],
    [404, "Проект не найден: возможно, он удалён или ссылка устарела"],
    [409, "План или операция уже изменились. Обновите данные и повторите действие"],
    [501, "Сервис планирования временно недоступен"]
  ] as const)("uses HTTP %i when the backend code is generic", (status, message) => {
    expect(mapPlanningError({ code: "request_failed", status })).toEqual({
      code: "request_failed",
      status,
      message
    });
  });

  it("maps a transport exception without leaking its raw message", () => {
    const result = mapPlanningError(new TypeError("Failed to fetch"), "load_failed");

    expect(result).toEqual({
      code: "transport_failure",
      message: "Не удалось связаться с сервисом планирования. Проверьте подключение и повторите"
    });
    expect(result.message).not.toContain("Failed to fetch");
  });
});
