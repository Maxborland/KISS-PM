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
  await page.getByLabel("Пароль").fill("local-admin-password");
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page.getByRole("heading", { name: "Рабочее пространство" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("complementary").getByText("Анна Администратор", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Экспорт" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сортировка" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Проекты" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Последние события аудита" })).toBeVisible();
  await page.getByRole("button", { name: "Свернуть навигацию" }).click();
  await expect(page.getByRole("button", { name: "Пользователи" })).toHaveAttribute(
    "title",
    "Пользователи"
  );
  await page.getByRole("button", { name: "Пользователи" }).focus();
  const collapsedSidebarBox = await page.locator(".sidebar").boundingBox();
  expect(collapsedSidebarBox?.width).toBeLessThan(120);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.locator(".sidebar")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(page.getByRole("heading", { name: "Рабочее пространство" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await expect(page.locator(".sidebar")).toBeInViewport();
  await expect(page.locator(".sidebar")).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sidebar")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".content-shell")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Быстро создать" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Выйти из рабочего пространства" })
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Быстро создать" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Открыть профиль" })).toBeFocused();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => page.locator(".sidebar").evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.locator(".sidebar")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(page.locator(".content-shell")).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Переход по разделам")).toBeFocused();
  await page.waitForTimeout(250);
  await expect(page.getByLabel("Переход по разделам")).toBeFocused();
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await page.getByRole("button", { name: "Главная" }).click();
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await page.getByRole("button", { name: "Должности" }).click();
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.getByRole("button", { name: "Открыть навигацию" })).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByLabel("Переход по разделам").fill("Должности");
  await page.getByLabel("Переход по разделам").press("Enter");
  await expect(page.getByRole("heading", { name: "Должности" }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/positions$/);

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
  await page.getByRole("button", { name: "Выйти из рабочего пространства" }).click();
  await page.getByLabel("Email").fill(`limited-${suffix}@kiss-pm.local`);
  await page.getByLabel("Пароль").fill("limited12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Рабочее пространство" })).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText(`Ограниченный ${suffix}`)
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти из рабочего пространства" }).click();
  await page.getByLabel("Email").fill("admin@kiss-pm.local");
  await page.getByLabel("Пароль").fill("local-admin-password");
  await page.getByRole("button", { name: "Войти" }).click();
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
