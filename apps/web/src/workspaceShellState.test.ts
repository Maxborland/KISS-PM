import { describe, expect, it } from "vitest";

import { ApiError } from "./api";
import {
  getErrorMessage,
  getMetricHint,
  getSectionState,
  hasPermission
} from "./workspaceShellState";

describe("workspace shell state helpers", () => {
  it("checks permissions by exact permission key", () => {
    expect(
      hasPermission(["tenant.users.read", "tenant.users.manage"], "tenant.users.read")
    ).toBe(true);
    expect(hasPermission(["tenant.users.read"], "tenant.users")).toBe(false);
  });

  it("builds unreadable section state without leaking loading or error state", () => {
    expect(getSectionState(false, true, new Error("Backend unavailable"))).toEqual({
      canRead: false,
      isLoading: false,
      error: null
    });
  });

  it("builds readable section state with localized error text", () => {
    expect(
      getSectionState(true, false, new ApiError("/api/users", 403, "access_denied"))
    ).toEqual({
      canRead: true,
      isLoading: false,
      error: "Недостаточно прав для этого действия."
    });
  });

  it("keeps dashboard metric hints stable for all section states", () => {
    expect(getMetricHint({ canRead: false, isLoading: false, error: null })).toBe(
      "Нет права на чтение"
    );
    expect(getMetricHint({ canRead: true, isLoading: true, error: null })).toBe(
      "Обновляем"
    );
    expect(getMetricHint({ canRead: true, isLoading: false, error: "Ошибка" })).toBe(
      "Ошибка загрузки"
    );
    expect(getMetricHint({ canRead: true, isLoading: false, error: null })).toBe(
      "Актуально"
    );
  });

  it("formats known, unknown and native errors for forms", () => {
    expect(getErrorMessage(new ApiError("/api/settings", 409, "system_key_immutable"))).toBe(
      "Системный ключ нельзя изменить после создания."
    );
    expect(getErrorMessage(new ApiError("/api/settings", 500, "new_backend_error"))).toBe(
      "Не удалось выполнить действие. Код ошибки: new_backend_error"
    );
    expect(getErrorMessage(new Error("Network failed"))).toBe("Network failed");
    expect(getErrorMessage(null)).toBe("Не удалось выполнить действие");
  });
});
