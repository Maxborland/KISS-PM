import { describe, expect, it } from "vitest";

import {
  getNextFocusTrapIndex,
  validatePositionForm,
  validateRoleForm,
  validateUserForm
} from "./workspaceForms";

describe("workspace form quality baseline", () => {
  it("validates create-user fields before a mutation starts", () => {
    expect(
      validateUserForm(
        {
          name: " ",
          email: "not-email",
          password: "short",
          accessProfileId: "",
          status: "paused"
        },
        "create"
      )
    ).toEqual({
      name: "Укажите имя пользователя.",
      email: "Введите корректный email.",
      password: "Пароль должен быть не короче 8 символов.",
      accessProfileId: "Выберите роль доступа.",
      status: "Выберите корректный статус."
    });
  });

  it("keeps edit-user password optional but validates shared fields", () => {
    expect(
      validateUserForm(
        {
          name: "Анна",
          email: "admin@kiss-pm.local",
          accessProfileId: "access-profile-alpha-admin",
          status: "active"
        },
        "edit"
      )
    ).toEqual({});
  });

  it("requires a role name and at least one permission", () => {
    expect(validateRoleForm({ name: "", permissions: [] })).toEqual({
      name: "Укажите название роли.",
      permissions: "Выберите хотя бы одно право."
    });
  });

  it("requires a position name", () => {
    expect(validatePositionForm({ name: "   " })).toEqual({
      name: "Укажите название должности."
    });
  });

  it("cycles focus inside the modal surface", () => {
    expect(getNextFocusTrapIndex(0, 4, true)).toBe(3);
    expect(getNextFocusTrapIndex(3, 4, false)).toBe(0);
    expect(getNextFocusTrapIndex(1, 4, false)).toBeNull();
  });
});
