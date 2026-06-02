import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("workspace agent proposes a task and applies it only after confirmation", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const taskTitle = `Проверить исходные данные QA ${Date.now()}`;

  await page.goto("/agent");
  await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
  await expect(page.getByText("Сверка изменений")).toBeVisible();

  await page.getByLabel("Сообщение Генри Гантту").fill(`Создай задачу: ${taskTitle}`);
  await page.getByRole("button", { name: "Отправить сообщение" }).click();

  const proposal = page.locator(".runtime-agent-proposal").filter({ hasText: taskTitle });

  await expect(proposal).toContainText(`Будет создана задача: ${taskTitle}`);
  await expect(proposal.getByRole("button", { name: "Применить" })).toBeVisible();
  await expect(proposal.getByRole("button", { name: "Отклонить" })).toBeVisible();
  await expect(proposal.getByRole("link", { name: /Открыть результат действия/ })).toHaveCount(0);

  const pendingScreenshotPath = testInfo.outputPath("runtime-agent-confirmation-pending.png");
  await page.screenshot({ fullPage: true, path: pendingScreenshotPath });
  expect(statSync(pendingScreenshotPath).size).toBeGreaterThan(8_000);

  await proposal.getByRole("button", { name: "Применить" }).click();

  await expect(proposal).toContainText("Изменение применено");
  await expect(proposal).toContainText(`Создана задача: ${taskTitle}`);
  await expect(proposal).toContainText(/Записано в аудит:/);

  const resultLink = proposal.getByRole("link", { name: /Открыть результат действия/ });
  await expect(resultLink).toContainText(taskTitle);

  const appliedScreenshotPath = testInfo.outputPath("runtime-agent-confirmation-applied.png");
  await page.screenshot({ fullPage: true, path: appliedScreenshotPath });
  expect(statSync(appliedScreenshotPath).size).toBeGreaterThan(8_000);

  await resultLink.click();
  await expect(page).toHaveURL(/\/my-work\?taskId=task-[^&]+$/);
  await expect(page.getByRole("dialog", { name: taskTitle, exact: true })).toBeVisible();
});
