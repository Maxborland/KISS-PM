import { expect, test } from "@playwright/test";

import {
  expectAdminDashboardReady,
  loginToWorkspace,
  logoutThroughUserMenu,
  verifyResponsiveNavigation
} from "./smokeHelpers";

test("single-workspace auth and RBAC scaffold works from the browser", async ({
  page,
  request
}) => {
  const health = await request.get("/health");
  expect(health.status()).toBe(200);

  const suffix = Date.now().toString(36);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Вход в рабочее пространство" })
  ).toBeVisible();
  await loginToWorkspace(page, { password: "local-admin-password" });
  await expectAdminDashboardReady(page);
  await verifyResponsiveNavigation(page);

  await page.getByRole("button", { name: "Должности" }).click();
  await expect(page.getByRole("heading", { name: "Должности" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Создать должность" }).click();
  const createPositionDialog = page.getByRole("dialog", { name: "Создать должность" });
  await expect(createPositionDialog).toBeVisible();
  await expect(createPositionDialog.getByLabel("Название должности")).toBeFocused();
  await createPositionDialog.getByRole("button", { name: "Создать должность" }).click();
  await expect(createPositionDialog.getByText("Укажите название должности.")).toBeVisible();
  await createPositionDialog.getByLabel("Название должности").fill(`Координатор ${suffix}`);
  await createPositionDialog.getByLabel("Описание").fill("Помогает вести проектный контур");
  await createPositionDialog.getByRole("button", { name: "Создать должность" }).click();
  await expect(page.getByText(`Координатор ${suffix}`)).toBeVisible();
  const positionRow = page.getByRole("row", { name: new RegExp(`Координатор ${suffix}`) });
  await positionRow.getByRole("button", { name: "Редактировать" }).click();
  const editPositionDialog = page.getByRole("dialog", { name: "Редактировать должность" });
  await expect(editPositionDialog).toBeVisible();
  await editPositionDialog.getByLabel("Название должности").fill(`Координатор ${suffix} обновлено`);
  await editPositionDialog.getByRole("button", { name: "Сохранить должность" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`Координатор ${suffix} обновлено`) })
  ).toBeVisible();
  await page
    .getByRole("row", { name: new RegExp(`Координатор ${suffix} обновлено`) })
    .getByRole("button", { name: "Удалить" })
    .click();
  const deletePositionDialog = page.getByRole("dialog", { name: "Удалить должность" });
  await expect(deletePositionDialog).toBeVisible();
  await expect(deletePositionDialog.getByText("Действие необратимо")).toBeVisible();
  await deletePositionDialog.getByRole("button", { name: "Удалить должность" }).click();
  await expect(page.getByText(`Координатор ${suffix} обновлено`)).toHaveCount(0);

  await page.getByRole("button", { name: "Роли доступа" }).click();
  await expect(page.getByRole("heading", { name: "Роли доступа" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Создать роль доступа" }).click();
  const createRoleDialog = page.getByRole("dialog", { name: "Создать роль доступа" });
  await expect(createRoleDialog).toBeVisible();
  await expect(createRoleDialog.getByLabel("Название роли")).toBeFocused();
  await createRoleDialog.getByRole("button", { name: "Создать роль доступа" }).click();
  await expect(createRoleDialog.getByText("Укажите название роли.")).toBeVisible();
  await createRoleDialog.getByLabel("Название роли").fill(`Наблюдатель ${suffix}`);
  await createRoleDialog.getByRole("button", { name: "Создать роль доступа" }).click();
  await expect(page.getByText(`Наблюдатель ${suffix}`)).toBeVisible();
  const roleRow = page.getByRole("row", { name: new RegExp(`Наблюдатель ${suffix}`) });
  await roleRow.getByRole("button", { name: "Редактировать" }).click();
  const editRoleDialog = page.getByRole("dialog", { name: "Редактировать роль доступа" });
  await expect(editRoleDialog).toBeVisible();
  await editRoleDialog.getByLabel("Название роли").fill(`Наблюдатель ${suffix} обновлено`);
  await editRoleDialog.getByRole("button", { name: "Сохранить роль доступа" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`Наблюдатель ${suffix} обновлено`) })
  ).toBeVisible();

  await page.getByRole("button", { name: "Быстро создать" }).click();
  await expect(page).toHaveURL(/\/users$/);
  const quickCreateUserDialog = page.getByRole("dialog", { name: "Создать пользователя" });
  await expect(quickCreateUserDialog).toBeVisible();
  await quickCreateUserDialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("heading", { name: "Пользователи" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Создать пользователя" }).click();
  const createUserDialog = page.getByRole("dialog", { name: "Создать пользователя" });
  await expect(createUserDialog).toBeVisible();
  await expect(createUserDialog.getByLabel("Имя")).toBeFocused();
  await createUserDialog.getByRole("button", { name: "Создать пользователя" }).click();
  await expect(createUserDialog.getByText("Укажите имя пользователя.")).toBeVisible();
  await expect(createUserDialog.getByText("Введите корректный email.")).toBeVisible();
  await expect(createUserDialog.getByText("Пароль должен быть не короче 8 символов.")).toBeVisible();
  await createUserDialog.getByLabel("Имя").fill(`Пользователь ${suffix}`);
  await createUserDialog.getByLabel("Email").fill(`user-${suffix}@kiss-pm.local`);
  const userPasswordField = createUserDialog.getByLabel("Пароль", { exact: true });
  await userPasswordField.fill("user12345");
  await createUserDialog.getByRole("button", { name: "Показать пароль" }).click();
  await expect(userPasswordField).toHaveAttribute("type", "text");
  await createUserDialog.getByRole("button", { name: "Скрыть пароль" }).click();
  await expect(userPasswordField).toHaveAttribute("type", "password");
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
  }
  await expect
    .poll(() =>
      createUserDialog.evaluate((element) => element.contains(document.activeElement))
    )
    .toBe(true);
  await createUserDialog
    .getByLabel("Роль доступа")
    .selectOption({ label: `Наблюдатель ${suffix} обновлено` });
  await createUserDialog.getByRole("button", { name: "Создать пользователя" }).click();
  await expect(page.getByText(`Пользователь ${suffix}`)).toBeVisible();
  const userRow = page.getByRole("row", { name: new RegExp(`Пользователь ${suffix}`) });
  await userRow.getByRole("button", { name: "Редактировать" }).click();
  const editUserDialog = page.getByRole("dialog", { name: "Редактировать пользователя" });
  await expect(editUserDialog).toBeVisible();
  await editUserDialog.getByLabel("Статус").selectOption("inactive");
  await editUserDialog.getByRole("button", { name: "Сохранить пользователя" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`Пользователь ${suffix}.*Отключен`) })
  ).toBeVisible();
  await page
    .getByRole("row", { name: new RegExp(`Пользователь ${suffix}`) })
    .getByRole("button", { name: "Удалить" })
    .click();
  const deleteUserDialog = page.getByRole("dialog", { name: "Удалить пользователя" });
  await expect(deleteUserDialog).toBeVisible();
  await deleteUserDialog.getByRole("button", { name: "Удалить пользователя" }).click();
  await expect(page.getByText(`Пользователь ${suffix}`)).toHaveCount(0);

  await page.getByRole("button", { name: "Роли доступа" }).click();
  await page
    .getByRole("row", { name: new RegExp(`Наблюдатель ${suffix} обновлено`) })
    .getByRole("button", { name: "Удалить" })
    .click();
  const deleteRoleDialog = page.getByRole("dialog", { name: "Удалить роль доступа" });
  await expect(deleteRoleDialog).toBeVisible();
  await deleteRoleDialog.getByRole("button", { name: "Удалить роль доступа" }).click();
  await expect(page.getByText(`Наблюдатель ${suffix} обновлено`)).toHaveCount(0);

  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Пользовательские поля" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Шаблоны проектов" })).toBeVisible();

  await page.getByRole("button", { name: "Создать поле" }).click();
  const createFieldDialog = page.getByRole("dialog", {
    name: "Создать пользовательское поле"
  });
  await expect(createFieldDialog).toBeVisible();
  await createFieldDialog.getByLabel("Системный ключ").fill("1-invalid");
  await createFieldDialog.getByRole("button", { name: "Сохранить поле" }).click();
  await expect(
    createFieldDialog.getByText("Системный ключ: латиница, цифры и _, начинается с буквы.")
  ).toBeVisible();
  await createFieldDialog.getByLabel("Системный ключ").fill(`priority_${suffix}`);
  await createFieldDialog.getByLabel("Название в интерфейсе").fill(`Приоритет ${suffix}`);
  await createFieldDialog.getByLabel("Тип поля").selectOption("select");
  await createFieldDialog.getByLabel("Статус").selectOption("active");
  await createFieldDialog.getByRole("button", { name: "Сохранить поле" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`Приоритет ${suffix}`) })).toBeVisible();
  const fieldRow = page.getByRole("row", { name: new RegExp(`Приоритет ${suffix}`) });
  await fieldRow.getByRole("button", { name: "Редактировать" }).click();
  const editFieldDialog = page.getByRole("dialog", {
    name: "Редактировать пользовательское поле"
  });
  await expect(editFieldDialog.getByLabel("Системный ключ")).toHaveAttribute("readonly", "");
  await editFieldDialog.getByLabel("Название в интерфейсе").fill(`Приоритет проекта ${suffix}`);
  await editFieldDialog.getByLabel("Обязательное поле").check();
  await editFieldDialog.getByRole("button", { name: "Сохранить поле" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`Приоритет проекта ${suffix}.*Да`) })
  ).toBeVisible();

  await page.getByRole("button", { name: "Создать шаблон" }).click();
  const createTemplateDialog = page.getByRole("dialog", { name: "Создать шаблон" });
  await expect(createTemplateDialog).toBeVisible();
  await createTemplateDialog.getByLabel("Системный ключ").fill("1-invalid");
  await createTemplateDialog.getByRole("button", { name: "Сохранить шаблон" }).click();
  await expect(
    createTemplateDialog.getByText("Системный ключ: латиница, цифры и _, начинается с буквы.")
  ).toBeVisible();
  await createTemplateDialog.getByLabel("Системный ключ").fill(`implementation_${suffix}`);
  await createTemplateDialog.getByLabel("Название шаблона").fill(`Внедрение ${suffix}`);
  await createTemplateDialog
    .getByLabel("Описание")
    .fill("Базовый шаблон внедрения для smoke проверки");
  await createTemplateDialog.getByLabel("Статус").selectOption("active");
  await createTemplateDialog.getByRole("button", { name: "Сохранить шаблон" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`Внедрение ${suffix}`) })).toBeVisible();
  const templateRow = page.getByRole("row", { name: new RegExp(`Внедрение ${suffix}`) });
  await templateRow.getByRole("button", { name: "Редактировать" }).click();
  const editTemplateDialog = page.getByRole("dialog", { name: "Редактировать шаблон" });
  await expect(editTemplateDialog.getByLabel("Системный ключ")).toHaveAttribute("readonly", "");
  await editTemplateDialog.getByLabel("Название шаблона").fill(`Внедрение проекта ${suffix}`);
  await editTemplateDialog
    .getByLabel("Описание")
    .fill("Обновленный базовый шаблон внедрения для smoke проверки");
  await editTemplateDialog.getByRole("button", { name: "Сохранить шаблон" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`Внедрение проекта ${suffix}`) })
  ).toBeVisible();

  await page.getByRole("button", { name: "Возможности" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole("heading", { name: "Возможности" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Создать возможность" }).click();
  const createOpportunityDialog = page.getByRole("dialog", { name: "Создать возможность" });
  await expect(createOpportunityDialog).toBeVisible();
  await expect(createOpportunityDialog.getByLabel("Клиент")).toBeFocused();
  await createOpportunityDialog.getByRole("button", { name: "Создать возможность" }).click();
  await expect(createOpportunityDialog.getByText("Укажите клиента.")).toBeVisible();
  await expect(
    createOpportunityDialog.getByText("Добавьте хотя бы одну строку потребности.")
  ).toBeVisible();
  await createOpportunityDialog.getByLabel("Клиент").fill(`Клиент ${suffix}`);
  await createOpportunityDialog.getByLabel("Контакт").fill(`Контакт ${suffix}`);
  await createOpportunityDialog
    .getByLabel("Название входящего проекта")
    .fill(`Контур внедрения ${suffix}`);
  await createOpportunityDialog.getByLabel("Тип проекта").fill("Внедрение");
  await createOpportunityDialog.getByLabel("Старт").fill("2026-07-01");
  await createOpportunityDialog.getByLabel("Плановый финиш").fill("2026-07-31");
  await createOpportunityDialog.getByLabel("Стоимость контракта").fill("960000");
  await createOpportunityDialog.getByLabel("Плановая норма часа").fill("6000");
  await expect(createOpportunityDialog.getByText("Плановая емкость: 160 ч")).toBeVisible();
  await createOpportunityDialog
    .getByLabel("Шаблон проекта")
    .selectOption({ label: `Внедрение проекта ${suffix}` });
  await createOpportunityDialog
    .getByLabel("Должность")
    .selectOption({ label: "Руководитель проекта" });
  await createOpportunityDialog.getByLabel("Часы").fill("80");
  await createOpportunityDialog.getByRole("button", { name: "Добавить строку потребности" }).click();
  await createOpportunityDialog
    .getByLabel("Должность")
    .nth(1)
    .selectOption({ label: "Инженер" });
  await createOpportunityDialog.getByLabel("Часы").nth(1).fill("80");
  await expect(createOpportunityDialog.getByText("Потребность по должностям: 160 ч")).toBeVisible();
  await createOpportunityDialog.getByRole("button", { name: "Создать возможность" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`Контур внедрения ${suffix}`) })
  ).toBeVisible();
  const opportunityRow = page.getByRole("row", {
    name: new RegExp(`Контур внедрения ${suffix}`)
  });
  await opportunityRow.getByRole("button", { name: "Проверить ресурсы" }).click();
  await expect(opportunityRow.getByText("Достаточно ресурса")).toBeVisible();
  await expect(opportunityRow.getByText(/Руководитель проекта: 80\/\d+ ч/)).toBeVisible();
  await opportunityRow.getByRole("button", { name: "Активировать" }).click();
  const activateProjectDialog = page.getByRole("dialog", { name: "Активировать проект" });
  await expect(activateProjectDialog).toBeVisible();
  await activateProjectDialog.getByRole("button", { name: "Активировать проект" }).click();
  await expect(opportunityRow.getByText("Проект создан")).toBeVisible();
  await page.getByRole("button", { name: "Проекты" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Проекты" }).first()).toBeVisible();
  await expect(
    page.getByRole("row", { name: new RegExp(`Контур внедрения ${suffix}`) })
  ).toBeVisible();

  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Аудит", exact: true })
    .click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(page.getByText("Пользовательское поле создано").first()).toBeVisible();
  await expect(page.getByText("Пользовательское поле обновлено").first()).toBeVisible();
  await expect(page.getByText("Шаблон проекта создан").first()).toBeVisible();
  await expect(page.getByText("Шаблон проекта обновлен").first()).toBeVisible();
  await expect(page.getByText("Возможность создана").first()).toBeVisible();
  await expect(page.getByText("Ресурсная проверка сделки выполнена").first()).toBeVisible();
  await expect(page.getByText("Проект активирован").first()).toBeVisible();
  await expect(page.getByText(new RegExp(`Название: Приоритет ${suffix} -> Приоритет проекта ${suffix}`))).toBeVisible();
  await expect(page.getByText(new RegExp(`Название: Внедрение ${suffix} -> Внедрение проекта ${suffix}`))).toBeVisible();

  await page.getByRole("button", { name: "Роли доступа" }).click();
  await page.getByRole("button", { name: "Создать роль доступа" }).click();
  const createLimitedRoleDialog = page.getByRole("dialog", { name: "Создать роль доступа" });
  await createLimitedRoleDialog.getByLabel("Название роли").fill(`Ограниченный ${suffix}`);
  await createLimitedRoleDialog.getByRole("button", { name: "Создать роль доступа" }).click();
  await page.getByRole("button", { name: "Пользователи" }).click();
  await page.getByRole("button", { name: "Создать пользователя" }).click();
  const createLimitedUserDialog = page.getByRole("dialog", { name: "Создать пользователя" });
  await createLimitedUserDialog.getByLabel("Имя").fill(`Ограниченный ${suffix}`);
  await createLimitedUserDialog.getByLabel("Email").fill(`limited-${suffix}@kiss-pm.local`);
  await createLimitedUserDialog.getByLabel("Пароль", { exact: true }).fill("limited12345");
  await createLimitedUserDialog
    .getByLabel("Роль доступа")
    .selectOption({ label: `Ограниченный ${suffix}` });
  await createLimitedUserDialog.getByRole("button", { name: "Создать пользователя" }).click();
  await logoutThroughUserMenu(page);
  await loginToWorkspace(page, {
    email: `limited-${suffix}@kiss-pm.local`,
    password: "limited12345"
  });
  await expect(page.getByRole("heading", { name: "Рабочее пространство" })).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText(`Ограниченный ${suffix}`)
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Аудит", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Настройки", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Возможности", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Проекты", exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Открыть оформление" })).toHaveCount(0);
  await page.getByRole("button", { name: "Открыть меню пользователя" }).click();
  const limitedAccountMenu = page.locator(".topbar-account-menu .account-menu");
  await expect(limitedAccountMenu).toBeVisible();
  await expect(limitedAccountMenu.getByRole("button", { name: /Профиль/ })).toBeVisible();
  await expect(limitedAccountMenu.getByRole("button", { name: /Оформление/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".account-menu")).toHaveCount(0);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/audit");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/opportunities");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await page.request.get("/api/tenant/current/audit-events")).status()).toBe(403);
  expect((await page.request.get("/api/workspace/opportunities")).status()).toBe(403);
  expect((await page.request.get("/api/workspace/projects")).status()).toBe(403);
  expect((await page.request.get("/api/workspace/config/custom-fields")).status()).toBe(403);
  expect((await page.request.get("/api/workspace/config/project-templates")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/workspace/config/custom-fields", {
        data: {
          id: `limited_field_${suffix}`,
          systemKey: `limited_field_${suffix}`,
          tenantLabel: "Ограниченное поле",
          targetEntity: "project",
          fieldType: "text",
          required: false,
          status: "draft"
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.patch("/api/workspace/config/custom-fields/not-found", {
        data: {
          systemKey: "not_found",
          tenantLabel: "Недоступное поле",
          targetEntity: "project",
          fieldType: "text",
          required: false,
          status: "draft"
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/workspace/config/project-templates", {
        data: {
          id: `limited_template_${suffix}`,
          systemKey: `limited_template_${suffix}`,
          tenantLabel: "Ограниченный шаблон",
          description: "",
          status: "draft"
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/workspace/opportunities", {
        data: {
          id: `limited-opportunity-${suffix}`,
          clientName: "Недоступный клиент",
          title: "Недоступная возможность",
          projectType: "Внедрение",
          plannedStart: "2026-07-01",
          plannedFinish: "2026-07-31",
          contractValue: 960000,
          plannedHourlyRate: 6000,
          probability: 50,
          demand: [{ positionId: "position-engineer", requiredHours: 10 }]
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/workspace/opportunities/not-found/feasibility", {
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/workspace/opportunities/not-found/activate", {
        data: {
          acceptedRiskReason: null
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  expect(
    (
      await page.request.patch("/api/workspace/config/project-templates/not-found", {
        data: {
          systemKey: "not_found",
          tenantLabel: "Недоступный шаблон",
          description: "",
          status: "draft"
        },
        headers: {
          "x-kiss-pm-action": "same-origin"
        }
      })
    ).status()
  ).toBe(403);
  await logoutThroughUserMenu(page);
  await loginToWorkspace(page, {
    email: "admin@kiss-pm.local",
    password: "local-admin-password"
  });
  await expect(page.getByRole("heading", { name: "Рабочее пространство" })).toBeVisible();

  await page.getByRole("button", { name: "Профиль", exact: true }).click();
  await page.getByLabel("Телефон").fill("+7 999 000-00-00");
  await page.getByRole("button", { name: "Сохранить профиль" }).click();
  await expect(page.getByText("Профиль обновлен")).toBeVisible();

  await page.getByRole("button", { name: "Оформление", exact: true }).click();
  await page.getByLabel("Акцентный цвет").fill("#2563eb");
  await page.getByRole("button", { name: "Применить тему" }).click();
  await expect(page.getByText("Тема обновлена")).toBeVisible();
});
