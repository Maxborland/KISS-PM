import { expect, test } from "@playwright/test";

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
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  await expect(page.getByText("Анна Администратор")).toBeVisible();

  await page.getByRole("button", { name: "Должности" }).click();
  await expect(page.getByRole("heading", { name: "CRUD должностей" })).toBeVisible();
  await page.getByRole("button", { name: "Создать должность" }).click();
  const createPositionDialog = page.getByRole("dialog", { name: "Создать должность" });
  await expect(createPositionDialog).toBeVisible();
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
  await deletePositionDialog.getByRole("button", { name: "Удалить должность" }).click();
  await expect(page.getByText(`Координатор ${suffix} обновлено`)).toHaveCount(0);

  await page.getByRole("button", { name: "Роли доступа" }).click();
  await expect(page.getByRole("heading", { name: "CRUD ролей доступа" })).toBeVisible();
  await page.getByRole("button", { name: "Создать роль доступа" }).click();
  const createRoleDialog = page.getByRole("dialog", { name: "Создать роль доступа" });
  await expect(createRoleDialog).toBeVisible();
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

  await page.getByRole("button", { name: "Пользователи" }).click();
  await expect(page.getByRole("heading", { name: "CRUD пользователей" })).toBeVisible();
  await page.getByRole("button", { name: "Создать пользователя" }).click();
  const createUserDialog = page.getByRole("dialog", { name: "Создать пользователя" });
  await expect(createUserDialog).toBeVisible();
  await createUserDialog.getByLabel("Имя").fill(`Пользователь ${suffix}`);
  await createUserDialog.getByLabel("Email").fill(`user-${suffix}@kiss-pm.local`);
  await createUserDialog.getByLabel("Пароль").fill("user12345");
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
  await createLimitedUserDialog.getByLabel("Пароль").fill("limited12345");
  await createLimitedUserDialog
    .getByLabel("Роль доступа")
    .selectOption({ label: `Ограниченный ${suffix}` });
  await createLimitedUserDialog.getByRole("button", { name: "Создать пользователя" }).click();
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.getByLabel("Email").fill(`limited-${suffix}@kiss-pm.local`);
  await page.getByLabel("Пароль").fill("limited12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  await expect(page.getByText(`Ограниченный ${suffix}`)).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.getByLabel("Email").fill("admin@kiss-pm.local");
  await page.getByLabel("Пароль").fill("admin12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();

  await page.getByRole("button", { name: "Профиль" }).click();
  await page.getByLabel("Телефон").fill("+7 999 000-00-00");
  await page.getByRole("button", { name: "Сохранить профиль" }).click();
  await expect(page.getByText("Профиль обновлен")).toBeVisible();

  await page.getByRole("button", { name: "Оформление" }).click();
  await page.getByLabel("Акцентный цвет").fill("#2563eb");
  await page.getByRole("button", { name: "Применить тему" }).click();
  await expect(page.getByText("Тема обновлена")).toBeVisible();
});
