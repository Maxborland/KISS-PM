import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("workspace agent reads focused project context without becoming project-specific @agent-focused-context", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const projectId = "project-beta-school-renovation";
  const projectTitle = "Школа на 600 мест — реконструкция";
  const taskTitle = `Проверить контекст проекта QA ${Date.now()}`;

  await page.goto(`/agent?projectId=${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/agent\\?projectId=${projectId}$`));
  await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
  await expect(page.getByText(projectTitle)).toBeVisible();
  await expect(page.getByText("Сообщения не меняют данные")).toBeVisible();

  const messageResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      response.ok() &&
      response.url().endsWith("/api/workspace/agent-thread/messages")
    );
  });

  await page.getByLabel("Сообщение Генри Гантту").fill(`Создай задачу: ${taskTitle}`);
  await page.getByRole("button", { name: "Отправить сообщение" }).click();

  const response = await messageResponse;
  const body = (await response.json()) as {
    context?: { focus?: { id?: string; title?: string; type?: string } };
    proposals?: Array<{ payload?: { task?: { description?: string; title?: string } } }>;
  };
  expect(body.context?.focus).toMatchObject({
    id: projectId,
    title: projectTitle,
    type: "project"
  });
  const responseProposal = body.proposals?.find((proposal) => proposal.payload?.task?.title === taskTitle);
  expect(responseProposal?.payload?.task).toMatchObject({
    title: taskTitle
  });
  expect(responseProposal?.payload?.task?.description).toContain(`Контекст: ${projectTitle}.`);

  const proposal = page.locator(".runtime-agent-proposal").filter({ hasText: taskTitle });
  await expect(proposal).toContainText(`Будет создана задача: ${taskTitle}`);
  await expect(proposal.getByRole("button", { name: "Применить" })).toBeVisible();

  const screenshotPath = testInfo.outputPath("runtime-agent-focused-project-context.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);
});
