import { statSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "./runtimeQaFixtures";

const architectCredentials = {
  email: "architect@kiss-pm.local",
  password: "architect12345"
};

test("workspace agent keeps denied apply safe when user lacks task create permission @agent-apply-forbidden", async ({
  page
}, testInfo) => {
  await login(page, architectCredentials);

  const taskTitle = `Не применить без права QA ${Date.now()}`;
  await expectMyWorkTask(page, taskTitle, false);

  await page.goto("/agent");
  await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
  await expect(page.getByText("Сообщения не меняют данные")).toBeVisible();

  await page.getByLabel("Сообщение Генри Гантту").fill(`Создай задачу: ${taskTitle}`);
  await page.getByRole("button", { name: "Отправить сообщение" }).click();

  const proposal = page.locator(".runtime-agent-proposal").filter({ hasText: taskTitle });
  await expect(proposal).toContainText(`Будет создана задача: ${taskTitle}`);
  await expect(proposal.getByRole("link", { name: /Открыть результат действия/ })).toHaveCount(0);

  const deniedApply = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      response.status() === 403 &&
      /\/api\/workspace\/agent-thread\/proposals\/[^/]+\/confirm$/.test(response.url())
    );
  });
  await proposal.getByRole("button", { name: "Применить" }).click();
  const deniedApplyResponse = await deniedApply;
  await expect(deniedApplyResponse.json()).resolves.toEqual({ error: "permission_missing" });

  await expect(page.getByText("Не удалось подтвердить действие агента.")).toBeVisible();
  await expect(proposal).toContainText(`Будет создана задача: ${taskTitle}`);
  await expect(proposal.getByRole("link", { name: /Открыть результат действия/ })).toHaveCount(0);
  await expectMyWorkTask(page, taskTitle, false);

  const screenshotPath = testInfo.outputPath("runtime-agent-apply-forbidden.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);
});

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Эл. почта").fill(credentials.email);
  await page.getByLabel("Пароль").fill(credentials.password);

  const loginRequest = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") &&
      response.request().method() === "POST" &&
      response.ok()
  );
  await page.getByRole("button", { name: "Войти" }).click();
  await loginRequest;
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectMyWorkTask(page: Page, title: string, exists: boolean) {
  const response = await page.request.get("/api/workspace/my-work");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { tasks?: Array<{ title?: string }> };
  const titles = body.tasks?.map((task) => task.title) ?? [];
  expect(titles.includes(title)).toBe(exists);
}
