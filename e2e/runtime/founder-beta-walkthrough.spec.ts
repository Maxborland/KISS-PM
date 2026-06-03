import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("founder-beta management walkthrough reaches the first unresolved beta blocker @founder-beta-walkthrough", async ({
  page
}, testInfo) => {
  test.fail(
    true,
    "Current blocker: deal detail and handoff runtime flow is not wired. Founder-beta walkthrough can reach dashboard, project, Gantt, My Work, agent, resources, audit, admin users, admin roles, clients, contacts and products, but still needs live deal detail/handoff proof."
  );

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
    await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /Ресурсы/ })).toBeVisible();
  });

  await test.step("audit must be a live runtime route for mutation proof", async () => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /Аудит/ })).toBeVisible();
  });

  await test.step("admin users must be a live runtime route for RBAC proof", async () => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: /Пользователи/ })).toBeVisible();
  });

  await test.step("client directory must be live runtime data for deal handoff proof", async () => {
    await page.goto("/directories/clients");
    await expect(page.getByRole("heading", { name: /Клиенты/ })).toBeVisible();
  });

  await test.step("contact directory must be live runtime data for deal handoff proof", async () => {
    await page.goto("/directories/contacts");
    await expect(page.getByRole("heading", { name: /Контакты/ })).toBeVisible();
  });

  await test.step("products directory must be live runtime data for deal handoff proof", async () => {
    await page.goto("/directories/products");
    await expect(page.getByRole("heading", { name: /Продукты/ })).toBeVisible();
  });

  await test.step("admin roles must be a live runtime route for RBAC proof", async () => {
    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { name: /Роли/ })).toBeVisible();
  });

  await test.step("deal detail must be a live runtime route for handoff proof", async () => {
    await page.goto("/deals/opportunity-beta-school-renovation");
    await expect(page.getByRole("heading", { name: /Сделка/ })).toBeVisible();
  });
});
