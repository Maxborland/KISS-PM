import { describe, expect, it } from "vitest";

import { buildLastWorkContext, contextStorageKey, readLastWorkContext } from "./last-work-context";

describe("last work context", () => {
  it("сохраняет только рабочий маршрут и разрешённый peek-параметр", () => {
    expect(buildLastWorkContext("/my-work", "?task=task-42&token=secret", "Мои задачи")).toEqual({
      href: "/my-work?task=task-42",
      label: "Мои задачи"
    });
    expect(buildLastWorkContext("/crm/deals", "?deal=deal-7&email=a%40b.test", "Сделки")).toEqual({
      href: "/crm/deals?deal=deal-7",
      label: "Сделки"
    });
  });

  it("не сохраняет dashboard, admin и внешние пути", () => {
    expect(buildLastWorkContext("/dashboard", "", "Дашборд")).toBeNull();
    expect(buildLastWorkContext("/admin/users", "", "Администрирование")).toBeNull();
    expect(buildLastWorkContext("https://evil.test", "", "Ссылка")).toBeNull();
  });

  it("изолирует запись по tenant и пользователю и терпит битый JSON", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    values.set(contextStorageKey("tenant-a", "user-a"), JSON.stringify({ href: "/agent", label: "Агент" }));
    values.set(contextStorageKey("tenant-a", "user-b"), "{");

    expect(readLastWorkContext(storage, "tenant-a", "user-a")).toEqual({ href: "/agent", label: "Агент" });
    expect(readLastWorkContext(storage, "tenant-a", "user-b")).toBeNull();
  });
});
