import { statSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("workspace agent does not mutate tasks before confirmation or after rejection @agent-confirmation-gate", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const taskTitle = `Не создавать без подтверждения QA ${Date.now()}`;

  await expectMyWorkTask(page, taskTitle, false);

  await page.goto("/agent");
  await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
  await expect(page.getByText("Сообщения не меняют данные")).toBeVisible();

  await page.getByLabel("Сообщение Генри Гантту").fill(`Создай задачу: ${taskTitle}`);
  await page.getByRole("button", { name: "Отправить сообщение" }).click();

  const proposal = page.locator(".runtime-agent-proposal").filter({ hasText: taskTitle });
  await expect(proposal).toContainText(`Будет создана задача: ${taskTitle}`);
  await expect(proposal.getByRole("button", { name: "Применить" })).toBeVisible();
  await expect(proposal.getByRole("button", { name: "Отклонить" })).toBeVisible();

  await expectMyWorkTask(page, taskTitle, false);

  const rejectResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      response.ok() &&
      response.url().includes("/api/workspace/agent-thread/proposals/") &&
      response.url().endsWith("/confirm")
    );
  });

  await proposal.getByRole("button", { name: "Отклонить" }).click();
  await rejectResponse;

  await expect(proposal).toContainText("отклонено");
  await expect(proposal).toContainText("Изменение не применено");
  await expect(proposal).toContainText(`Задача не создана: ${taskTitle}`);
  await expect(proposal).toContainText(/Записано в аудит:/);
  await expect(proposal.getByRole("link", { name: /Открыть результат действия/ })).toHaveCount(0);

  await expectMyWorkTask(page, taskTitle, false);

  const rejectedScreenshotPath = testInfo.outputPath("runtime-agent-rejected-no-mutation.png");
  await page.screenshot({ fullPage: true, path: rejectedScreenshotPath });
  expect(statSync(rejectedScreenshotPath).size).toBeGreaterThan(8_000);
});

async function expectMyWorkTask(page: Page, title: string, exists: boolean) {
  const response = await page.request.get("/api/workspace/my-work");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { tasks?: Array<{ title?: string }> };
  const titles = body.tasks?.map((task) => task.title) ?? [];
  expect(titles.includes(title)).toBe(exists);
}
