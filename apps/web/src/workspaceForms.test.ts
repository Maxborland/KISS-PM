import { describe, expect, it } from "vitest";

import {
  getNextFocusTrapIndex,
  validateCustomFieldForm,
  validatePositionForm,
  validateProjectTemplateForm,
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

  it("validates custom field configuration before API mutation", () => {
    expect(
      validateCustomFieldForm({
        systemKey: "Invalid Key",
        tenantLabel: "",
        targetEntity: "project",
        fieldType: "money",
        status: "archived"
      })
    ).toEqual({
      systemKey: "Системный ключ: латиница, цифры и _, начинается с буквы.",
      tenantLabel: "Укажите русское название поля.",
      fieldType: "Выберите тип поля.",
      status: "Выберите статус настройки."
    });
  });

  it("validates project template configuration before API mutation", () => {
    expect(
      validateProjectTemplateForm({
        systemKey: "bad key",
        tenantLabel: "",
        description: "x".repeat(1001),
        status: "archived"
      })
    ).toEqual({
      systemKey: "Системный ключ: латиница, цифры и _, начинается с буквы.",
      tenantLabel: "Укажите название шаблона.",
      description: "Описание должно быть не длиннее 1000 символов.",
      status: "Выберите статус шаблона."
    });
  });

  it("cycles focus inside the modal surface", () => {
    expect(getNextFocusTrapIndex(0, 4, true)).toBe(3);
    expect(getNextFocusTrapIndex(3, 4, false)).toBe(0);
    expect(getNextFocusTrapIndex(1, 4, false)).toBeNull();
  });
});
