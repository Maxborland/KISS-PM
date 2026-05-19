import { describe, expect, it } from "vitest";

import {
  getNextFocusTrapIndex,
  validateOpportunityForm,
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

  it("validates manual opportunity intake before API mutation", () => {
    expect(
      validateOpportunityForm({
        clientName: "",
        title: "",
        projectType: "",
        plannedStart: "2026-06-30",
        plannedFinish: "2026-06-01",
        contractValue: "0",
        plannedHourlyRate: "0",
        probability: "120",
        demand: [
          { positionId: "", requiredHours: "0" },
          { positionId: "position-engineer", requiredHours: "10" },
          { positionId: "position-engineer", requiredHours: "20" }
        ]
      })
    ).toEqual({
      clientName: "Укажите клиента.",
      title: "Укажите название входящего проекта.",
      projectType: "Укажите тип проекта.",
      plannedFinish: "Дата финиша не может быть раньше старта.",
      contractValue: "Стоимость контракта должна быть больше 0.",
      plannedHourlyRate: "Плановая норма часа должна быть больше 0.",
      probability: "Вероятность должна быть от 0 до 100.",
      demand: "Каждая строка потребности должна содержать должность и часы.",
      demandDuplicates: "Должность в потребности нельзя дублировать."
    });
  });

  it("keeps workspace config form limits aligned with the domain contract", () => {
    expect(
      validateCustomFieldForm({
        systemKey: `a${"x".repeat(79)}`,
        tenantLabel: "x".repeat(120),
        targetEntity: "project",
        fieldType: "select",
        status: "active"
      })
    ).toEqual({});

    expect(
      validateCustomFieldForm({
        systemKey: `a${"x".repeat(80)}`,
        tenantLabel: "x".repeat(121),
        targetEntity: "project",
        fieldType: "select",
        status: "active"
      })
    ).toEqual({
      systemKey: "Системный ключ: латиница, цифры и _, начинается с буквы.",
      tenantLabel: "Укажите русское название поля."
    });

    expect(
      validateProjectTemplateForm({
        systemKey: "implementation",
        tenantLabel: "Типовой проект",
        description: "x".repeat(1000),
        status: "draft"
      })
    ).toEqual({});

    expect(
      validateProjectTemplateForm({
        systemKey: "implementation",
        tenantLabel: "Типовой проект",
        description: "x".repeat(1001),
        status: "draft"
      })
    ).toEqual({
      description: "Описание должно быть не длиннее 1000 символов."
    });
  });

  it("cycles focus inside the modal surface", () => {
    expect(getNextFocusTrapIndex(0, 4, true)).toBe(3);
    expect(getNextFocusTrapIndex(3, 4, false)).toBe(0);
    expect(getNextFocusTrapIndex(1, 4, false)).toBeNull();
  });
});
