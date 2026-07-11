import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page, type Response } from "@playwright/test";

const evidenceRoot = join(
  process.cwd(),
  ".superloopy",
  "evidence",
  "auth-shell-2026-07-10",
  "screenshots",
  "auth-public"
);

const runId = `${Date.now().toString(36)}-${process.pid}`;
const registeredUser = {
  name: `Auth Public ${runId}`,
  email: `auth-public-${runId}@example.test`,
  password: "Auth-public-12345",
  resetPassword: "Auth-public-reset-67890"
};

test.describe.serial("Lane 1 AUTH PUBLIC", () => {
  test.beforeAll(async () => {
    await mkdir(evidenceRoot, { recursive: true });
  });

  test("AUTH-LOGIN: validation, reveal, Enter submit, refresh and logout", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();

    const email = page.getByLabel("Email");
    const password = page.getByLabel("Пароль", { exact: true });
    const submit = page.getByRole("button", { name: "Войти" });

    await email.fill("not-an-email");
    await password.fill("wrong-password");
    await expect(email).toHaveJSProperty("validity.valid", false);
    await expect(submit).toBeDisabled();

    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Показать пароль" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Скрыть пароль" }).click();
    await expect(password).toHaveAttribute("type", "password");

    await email.fill("admin@kiss-pm.local");
    const invalidResponsePromise = waitForAuthResponse(page, "/api/auth/login");
    await password.press("Enter");
    const invalidResponse = await invalidResponsePromise;
    expect(invalidResponse.status()).toBe(401);
    await expect(invalidResponse.json()).resolves.toEqual({ error: "invalid_credentials" });
    await expect(page.getByRole("alert").filter({ hasText: "Неверный email или пароль" })).toHaveText(
      "Неверный email или пароль"
    );
    await screenshot(page, "auth-login-invalid-credentials.png");

    await password.fill("admin12345");
    const loginResponsePromise = waitForAuthResponse(page, "/api/auth/login");
    await password.press("Enter");
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);
    const loginBody = (await loginResponse.json()) as { user?: { name?: string } };
    expect(loginBody.user?.name).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
    const meBeforeReload = await browserReadback(page, "/api/auth/me");
    expect(meBeforeReload.status).toBe(200);
    expect(meBeforeReload.body).toMatchObject({ user: { name: loginBody.user?.name } });

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
    const meAfterReload = await browserReadback(page, "/api/auth/me");
    expect(meAfterReload).toEqual(meBeforeReload);
    await screenshot(page, "auth-login-success-after-reload.png");

    const logoutResponsePromise = waitForAuthResponse(page, "/api/auth/logout");
    await logoutThroughUserMenu(page);
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.status()).toBe(200);
    await expect(logoutResponse.json()).resolves.toEqual({ status: "ok" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Вход в KISS PM" })).toBeVisible();
    const meAfterLogout = await browserReadback(page, "/api/auth/me");
    expect(meAfterLogout).toEqual({ status: 401, body: { error: "session_required" } });
    await screenshot(page, "auth-login-logout-readback.png");
  });

  test("AUTH-REGISTER: invalid, weak, unique success and duplicate", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Регистрация" })).toBeVisible();

    const name = page.getByLabel("Имя");
    const email = page.getByLabel("Email");
    const password = page.locator('input[autocomplete="new-password"]');

    await name.fill(registeredUser.name);
    await email.fill("not-an-email");
    await password.fill(registeredUser.password);
    await page.getByRole("button", { name: "Показать пароль" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Скрыть пароль" }).click();
    await expect(password).toHaveAttribute("type", "password");
    const invalidResponsePromise = waitForAuthResponse(page, "/api/auth/register");
    await password.press("Enter");
    const invalidResponse = await invalidResponsePromise;
    expect(invalidResponse.status()).toBe(400);
    await expect(invalidResponse.json()).resolves.toEqual({ error: "invalid_registration_payload" });
    await expect(page.getByRole("alert").filter({ hasText: "Проверьте имя, email и пароль" })).toHaveText(
      "Проверьте имя, email и пароль"
    );

    await email.fill(registeredUser.email);
    await password.fill("short");
    const weakResponsePromise = waitForAuthResponse(page, "/api/auth/register");
    await password.press("Enter");
    const weakResponse = await weakResponsePromise;
    expect(weakResponse.status()).toBe(400);
    await expect(weakResponse.json()).resolves.toEqual({ error: "weak_password" });
    await expect(
      page.getByRole("alert").filter({ hasText: "Пароль слишком простой — минимум 8 символов" })
    ).toHaveText("Пароль слишком простой — минимум 8 символов");
    await screenshot(page, "auth-register-invalid-and-weak.png");

    await password.fill(registeredUser.password);
    const registerResponsePromise = waitForAuthResponse(page, "/api/auth/register");
    await password.press("Enter");
    const registerResponse = await registerResponsePromise;
    expect(registerResponse.status()).toBe(201);
    const registerBody = (await registerResponse.json()) as {
      user: { name: string };
      workspace: { id: string };
    };
    expect(registerBody.user.name).toBe(registeredUser.name);
    expect(registerBody.workspace.id).toMatch(/^tenant-/);

    await expect(page).toHaveURL(/\/dashboard$/);
    const meAfterRegister = await browserReadback(page, "/api/auth/me");
    expect(meAfterRegister).toMatchObject({
      status: 200,
      body: {
        user: { name: registeredUser.name },
        workspace: { id: registerBody.workspace.id }
      }
    });
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
    expect(await browserReadback(page, "/api/auth/me")).toEqual(meAfterRegister);
    await screenshot(page, "auth-register-success-after-reload.png");

    const logoutResponsePromise = waitForAuthResponse(page, "/api/auth/logout");
    await logoutThroughUserMenu(page);
    expect((await logoutResponsePromise).status()).toBe(200);
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/register");
    await page.getByLabel("Имя").fill(`${registeredUser.name} Duplicate`);
    await page.getByLabel("Email").fill(registeredUser.email);
    await page.locator('input[autocomplete="new-password"]').fill(registeredUser.password);
    const duplicateResponsePromise = waitForAuthResponse(page, "/api/auth/register");
    await page.locator('input[autocomplete="new-password"]').press("Enter");
    const duplicateResponse = await duplicateResponsePromise;
    expect(duplicateResponse.status()).toBe(409);
    await expect(duplicateResponse.json()).resolves.toEqual({ error: "email_taken" });
    await expect(page.getByRole("alert").filter({ hasText: "Этот email уже зарегистрирован" })).toHaveText(
      "Этот email уже зарегистрирован"
    );
    expect(await browserReadback(page, "/api/auth/me")).toEqual({
      status: 401,
      body: { error: "session_required" }
    });
    await screenshot(page, "auth-register-duplicate.png");
  });

  test("AUTH-RESET: created user request, invalid token and live delivery", async ({ page }) => {
    await page.goto("/password-reset");
    await expect(page.getByRole("heading", { name: "Сброс пароля" })).toBeVisible();

    const email = page.getByLabel("Email");
    await email.fill("not-an-email");
    const invalidEmailResponsePromise = waitForAuthResponse(
      page,
      "/api/auth/password-reset/request"
    );
    await email.press("Enter");
    const invalidEmailResponse = await invalidEmailResponsePromise;
    expect(invalidEmailResponse.status()).toBe(400);
    await expect(invalidEmailResponse.json()).resolves.toEqual({ error: "invalid_email" });
    await expect(page.getByRole("alert").filter({ hasText: "Некорректный email" })).toHaveText(
      "Некорректный email"
    );
    await screenshot(page, "auth-reset-invalid-email.png");

    await email.fill(registeredUser.email);
    const resetRequestResponsePromise = waitForAuthResponse(
      page,
      "/api/auth/password-reset/request"
    );
    await email.press("Enter");
    const resetRequestResponse = await resetRequestResponsePromise;
    expect(resetRequestResponse.status()).toBe(202);
    const resetRequestBody = (await resetRequestResponse.json()) as {
      status: string;
      delivery?: "email" | "none";
    };
    expect(resetRequestBody.status).toBe("ok");
    await expect(page.getByRole("status")).toContainText(
      resetRequestBody.delivery === "email"
        ? "Если адрес зарегистрирован"
        : "отправка почты в этой инсталляции не настроена"
    );
    await screenshot(page, `auth-reset-request-delivery-${resetRequestBody.delivery ?? "missing"}.png`);

    await page.goto(`/password-reset/confirm?token=${"a".repeat(64)}`);
    await expect(page.getByRole("heading", { name: "Новый пароль" })).toBeVisible();
    await expect(page.getByLabel("Токен сброса")).toHaveValue("a".repeat(64));
    const newPassword = page.getByLabel("Новый пароль");
    await newPassword.fill(registeredUser.resetPassword);
    await page.getByRole("button", { name: "Показать пароль" }).click();
    await expect(newPassword).toHaveAttribute("type", "text");
    const invalidTokenResponsePromise = waitForAuthResponse(
      page,
      "/api/auth/password-reset/confirm"
    );
    await newPassword.press("Enter");
    const invalidTokenResponse = await invalidTokenResponsePromise;
    expect(invalidTokenResponse.status()).toBe(400);
    await expect(invalidTokenResponse.json()).resolves.toEqual({ error: "invalid_reset_token" });
    await expect(
      page.getByRole("alert").filter({ hasText: "Ссылка для сброса недействительна" })
    ).toHaveText("Ссылка для сброса недействительна");
    await screenshot(page, "auth-reset-invalid-token.png");

    expect(
      resetRequestBody.delivery,
      [
        `AUTH-RESET blocker for ${registeredUser.email}.`,
        "Expected: delivery=email with a retrievable SMTP message so the created user's raw token can drive confirm, new-password login, reload, logout and token reuse checks.",
        `Actual: delivery=${resetRequestBody.delivery ?? "missing"}; the running API exposes no auth reset-token test hook, and only a token hash is persisted.`
      ].join(" ")
    ).toBe("email");
  });
});

async function waitForAuthResponse(page: Page, pathname: string): Promise<Response> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === pathname && response.request().method() === "POST";
  });
}

async function browserReadback(page: Page, pathname: string) {
  return page.evaluate(async (path) => {
    const response = await fetch(path, { credentials: "same-origin" });
    return { status: response.status, body: await response.json() };
  }, pathname);
}

async function logoutThroughUserMenu(page: Page) {
  const explicitMenuButton = page.getByRole("button", { name: "Открыть меню пользователя" });
  if (await explicitMenuButton.count()) {
    await explicitMenuButton.click();
  } else {
    await page.getByRole("banner").getByRole("button").last().click();
  }

  const menuItem = page.getByRole("menuitem", { name: "Выйти" });
  if (await menuItem.count()) {
    await menuItem.click();
  } else {
    await page.getByRole("button", { name: "Выйти из рабочего пространства" }).click();
  }
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: join(evidenceRoot, name), fullPage: true });
}
