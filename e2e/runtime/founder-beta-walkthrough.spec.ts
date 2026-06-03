import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("founder-beta management walkthrough covers the current runtime spine through deal handoff @founder-beta-walkthrough", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await test.step("dashboard opens with live operational cockpit data", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Живая сводка по проектам")).toBeVisible();
    await expect(page.getByText("Что требует внимания")).toBeVisible();
    await expect(page.getByText("Ресурсные риски")).toBeVisible();
    await expect(page.getByText("Управленческий агент")).toBeVisible();
  });

  await test.step("attention cockpit must link the user into the affected entity", async () => {
    const attentionRow = page.getByRole("row", { name: /Обмерить существующие классы/ });
    await expect(attentionRow).toBeVisible();

    const screenshotPath = testInfo.outputPath("founder-beta-walkthrough-dashboard-attention-linked.png");
    await page.screenshot({ fullPage: true, path: screenshotPath });
    expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

    const attentionLink = attentionRow.getByRole("link", { name: /Открыть сигнал: Обмерить существующие классы/ });
    await expect(attentionLink).toHaveAttribute(
      "href",
      /\/projects\/project-beta-school-renovation\?taskId=task-beta-school-survey/
    );
    await attentionLink.click();
    await expect(page).toHaveURL(/\/projects\/project-beta-school-renovation\?taskId=task-beta-school-survey$/);
    await expect(page.getByRole("heading", { level: 1, name: "Школа на 600 мест — реконструкция" })).toBeVisible();
  });

  await test.step("existing project/timeline/my-work/agent surfaces stay reachable", async () => {
    await page.goto("/projects/project-beta-school-renovation/timeline");
    await expect(page.getByRole("grid", { name: /Диаграмма Ганта/ })).toBeVisible();

    await page.goto("/my-work");
    await expect(page).toHaveURL(/\/my-work$/);
    await expect(page.locator("body")).toContainText("Моя работа");

    await page.goto("/agent");
    await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
  });

  await test.step("project resources must be a live runtime route for workload proof", async () => {
    await page.goto("/projects/project-beta-school-renovation/resources");
    await expect(page.getByRole("heading", { level: 1, name: /Ресурсы/ })).toBeVisible();
  });

  await test.step("audit must be a live runtime route for mutation proof", async () => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { level: 1, name: /Аудит/ })).toBeVisible();
  });

  await test.step("admin users must be a live runtime route for RBAC proof", async () => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { level: 1, name: /Пользователи/ })).toBeVisible();
  });

  await test.step("client directory must be live runtime data for deal handoff proof", async () => {
    await page.goto("/directories/clients");
    await expect(page.getByRole("heading", { level: 1, name: /Клиенты/ })).toBeVisible();
  });

  await test.step("contact directory must be live runtime data for deal handoff proof", async () => {
    await page.goto("/directories/contacts");
    await expect(page.getByRole("heading", { level: 1, name: /Контакты/ })).toBeVisible();
  });

  await test.step("products directory must be live runtime data for deal handoff proof", async () => {
    await page.goto("/directories/products");
    await expect(page.getByRole("heading", { level: 1, name: /Продукты/ })).toBeVisible();
  });

  await test.step("admin roles must be a live runtime route for RBAC proof", async () => {
    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { level: 1, name: /Роли/ })).toBeVisible();
  });

  await test.step("deal detail must be a live runtime route for handoff proof", async () => {
    await page.goto("/deals/opportunity-beta-school-renovation");
    await expect(page.getByRole("heading", { level: 1, name: /Сделка/ })).toBeVisible();
    await expect(page.getByText("Школа на 600 мест — реконструкция", { exact: true })).toBeVisible();
  });

  await test.step("deal handoff must create or open a real project", async () => {
    await page.getByRole("button", { name: /Передать в проект/ }).click();
    await page.getByRole("button", { name: /Подтвердить передачу/ }).click();
    await expect(page.getByRole("link", { name: /Открыть проект/ })).toBeVisible();
    await page.getByRole("link", { name: /Открыть проект/ }).click();
    await expect(page).toHaveURL(/\/projects\/project-beta-school-renovation$/);
    await expect(page.getByRole("heading", { level: 1, name: "Школа на 600 мест — реконструкция" })).toBeVisible();
  });

  await test.step("audit must show project evidence after handoff path", async () => {
    await page.goto("/admin/audit");
    await expect(page.getByText("project.risk.seeded")).toBeVisible();
  });
});
