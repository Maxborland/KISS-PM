import { describe, expect, it } from "vitest";
import { adminErr, auditActionLabel } from "./admin-bits";

// Регресс BUG-ADM-01 / SHELL-06: коды авторизации не должны утекать сырыми в UI.
describe("adminErr", () => {
  it("translates auth/permission error codes to RU", () => {
    expect(adminErr("session_required")).toBe("Требуется вход в систему");
    expect(adminErr("permission_missing")).toBe("Недостаточно прав для этого действия");
    expect(adminErr("forbidden")).toBe("Доступ запрещён");
  });

  it("never leaks an unknown raw code — falls back to generic RU text", () => {
    expect(adminErr("some_unknown_code")).toBe("Не удалось выполнить действие");
    expect(adminErr(undefined)).toBe("Не удалось выполнить действие");
  });

  it("still honours an explicit fallback when provided", () => {
    expect(adminErr("some_unknown_code", "Своё сообщение")).toBe("Своё сообщение");
  });
});

// Регресс BUG-ADM-05: audit-метки ролей завязаны на реальные action-типы API (tenant.access_profile.*).
describe("auditActionLabel", () => {
  it("translates the access-profile lifecycle events the API actually emits", () => {
    expect(auditActionLabel("tenant.access_profile.created")).toBe("Роль создана");
    expect(auditActionLabel("tenant.access_profile.updated")).toBe("Роль изменена");
    expect(auditActionLabel("tenant.access_profile.deleted")).toBe("Роль удалена");
  });

  it("falls back to the raw action type for unknown events", () => {
    expect(auditActionLabel("something.unmapped")).toBe("something.unmapped");
  });
});
