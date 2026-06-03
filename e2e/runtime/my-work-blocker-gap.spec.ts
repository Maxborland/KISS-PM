import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("my work shows blocker as explicit data-contract gap without fake mutation", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/my-work?taskId=task-beta-school-survey");

  const taskDrawer = page.getByRole("dialog");
  await expect(taskDrawer.getByRole("heading", { level: 1, name: "Обмерить существующие классы" })).toBeVisible();

  const blockerButton = taskDrawer.getByRole("button", {
    name: "Блокер задачи Обмерить существующие классы"
  });
  await expect(blockerButton).toBeDisabled();
  await expect(taskDrawer).toContainText(
    "Причина блокера не хранится в текущих данных; для внимания используйте статус «Ожидает»."
  );

  const screenshotPath = testInfo.outputPath("runtime-my-work-blocker-gap.png");
  await taskDrawer.screenshot({ path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.goto("/my-work?taskId=task-beta-school-expertise-pack");
  const waitingDrawer = page.getByRole("dialog");
  await expect(waitingDrawer.getByRole("heading", { level: 1, name: "Собрать пакет на экспертизу" })).toBeVisible();
  await expect(waitingDrawer).toContainText("Ожидает: задача уже попадает во внимание.");
});
