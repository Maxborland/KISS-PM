import { expect, type Page } from "@playwright/test";

export async function loginToWorkspace(
  page: Page,
  input: { email?: string; password: string }
) {
  if (input.email) {
    await page.getByLabel("Email").fill(input.email);
  }
  await page.getByLabel("Пароль").fill(input.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect
    .poll(async () => (await page.request.get("/api/auth/me")).status())
    .toBe(200);
}

export async function logoutThroughUserMenu(page: Page) {
  await page.getByRole("button", { name: "Открыть меню пользователя" }).click();
  await page.getByRole("button", { name: "Выйти из рабочего пространства" }).click();
}

export async function expectAdminDashboardReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Рабочее пространство" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("complementary").getByText("Анна Администратор", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Экспорт" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сортировка" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Создать сделку" })).toHaveCount(0);
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Сделки" })
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Проекты" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Последние события аудита" })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Последние пользователи" }).locator(".checkbox-visual")
  ).toHaveCount(0);
}

export async function verifyResponsiveNavigation(page: Page) {
  await page.getByRole("button", { name: "Открыть меню профиля" }).click();
  await expect(page.locator(".account-menu")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".account-menu")).toHaveCount(0);
  await expect(page.locator(".sidebar-account-menu .account-menu")).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Свернуть навигацию" }).click();
  await expect(page.getByRole("button", { name: "Пользователи" })).toHaveAttribute(
    "title",
    "Пользователи"
  );
  await expect(page.getByRole("button", { name: "Открыть профиль" })).toHaveCount(0);
  await page.getByRole("button", { name: "Открыть меню профиля" }).click();
  await expect(page.locator(".account-menu")).toBeVisible();
  const compactAccountMenuBox = await page.locator(".sidebar-account-menu .account-menu").boundingBox();
  const compactSidebarBox = await page.locator(".sidebar").boundingBox();
  expect(compactAccountMenuBox?.x).toBeGreaterThanOrEqual(
    Math.floor((compactSidebarBox?.x ?? 0) + (compactSidebarBox?.width ?? 0))
  );
  await page.keyboard.press("Escape");
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
  await expect(page.getByRole("button", { name: "Главная" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Открыть меню профиля" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".account-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".account-menu")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toBeInViewport();
  await expect(page.locator(".content-shell")).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("button", { name: "Открыть меню профиля" })
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Главная" })).toBeFocused();
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
}
