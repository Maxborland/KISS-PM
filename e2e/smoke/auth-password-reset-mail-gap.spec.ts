import { expect, test } from "@playwright/test";

test("password reset browser flow exposes missing live mail delivery path", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();

  await page.getByRole("link", { name: "Забыли пароль?" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
  await expect(page.getByRole("heading", { name: "Сброс пароля" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("");

  const requestResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/password-reset/request") &&
      response.request().method() === "POST"
  );
  await page.getByLabel("Email").fill("admin@kiss-pm.local");
  await page.getByRole("button", { name: "Отправить инструкции" }).click();
  const response = await requestResponse;
  expect(response.status()).toBe(202);
  // delivery — свойство инсталляции: "none" без SMTP (CI), "email" при настроенном
  // канале (локальный Mailpit). Спек проверяет честность обеих веток UI, а не одну.
  const body = (await response.json()) as { status: string; delivery: string };
  expect(body.status).toBe("ok");
  expect(["none", "email"]).toContain(body.delivery);

  if (body.delivery === "none") {
    await expect(page.getByRole("status")).toContainText("отправка почты в этой инсталляции не настроена");
  } else {
    await expect(page.getByRole("status")).toContainText("Если адрес зарегистрирован — мы отправили инструкции");
  }
  await expect(page.getByText("Демо: почтового провайдера нет")).toHaveCount(0);
  await expect
    .poll(() => page.locator("body").innerText())
    .not.toMatch(/\b[a-f0-9]{64}\b/);

  await page.getByRole("link", { name: "Уже есть токен? Перейти к подтверждению" }).click();
  await expect(page).toHaveURL(/\/password-reset\/confirm$/);
  await expect(page.getByRole("heading", { name: "Новый пароль" })).toBeVisible();
  await expect(page.getByLabel("Токен сброса")).toHaveValue("");

  await page.goto(`/password-reset/confirm?token=${"a".repeat(64)}`);
  await expect(page.getByLabel("Токен сброса")).toHaveValue("a".repeat(64));
  await page.getByRole("link", { name: "Нет токена? Запросить сброс заново" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
});
