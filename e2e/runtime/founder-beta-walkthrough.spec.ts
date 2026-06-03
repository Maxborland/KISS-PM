import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("founder-beta management walkthrough covers the runtime action spine @founder-beta-walkthrough", async ({
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
    const attentionRow = page.getByRole("row", { name: /Открыть сигнал: Обмерить существующие классы/ });
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

  await test.step("project task status mutation persists after reload", async () => {
    const taskRow = page.getByRole("row", { name: /Обмерить существующие классы/ });
    await expect(taskRow).toBeVisible();

    const currentText = await taskRow.textContent();
    const targetStatus = currentText?.includes("На контроле") ? "В работе" : "На контроле";
    const statusPatch = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        /\/api\/workspace\/projects\/project-beta-school-renovation\/tasks\/task-beta-school-survey\/status$/.test(
          response.url()
        )
    );
    await taskRow.getByLabel("Статус задачи Обмерить существующие классы").click();
    await page.getByRole("option", { name: targetStatus }).click();
    expect((await statusPatch).status()).toBe(200);

    await expect(taskRow).toContainText(targetStatus);
    await page.reload();
    await expect(page.getByRole("row", { name: /Обмерить существующие классы/ })).toContainText(
      targetStatus
    );
  });

  let targetDueDate = "2026-05-10";

  await test.step("timeline changes the same task due date and project detail sees it", async () => {
    await page.goto("/projects/project-beta-school-renovation/timeline");
    await expect(page.getByRole("grid", { name: /Диаграмма Ганта/ })).toBeVisible();

    const dueDateInput = page.getByLabel("Новый финиш задачи");
    await expect(dueDateInput).toBeVisible();
    const currentDueDate = await dueDateInput.inputValue();
    targetDueDate = currentDueDate === "2026-05-10" ? "2026-05-11" : "2026-05-10";
    await dueDateInput.fill(targetDueDate);
    const duePatch = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        /\/api\/workspace\/tasks\/task-beta-school-survey$/.test(response.url())
    );
    await page.getByRole("button", { name: "Обновить срок" }).click();
    expect((await duePatch).status()).toBe(200);
    await expect(dueDateInput).toHaveValue(targetDueDate);

    const screenshotPath = testInfo.outputPath("founder-beta-walkthrough-timeline-date-updated.png");
    await page.screenshot({ fullPage: true, path: screenshotPath });
    expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

    await page.reload();
    await expect(page.getByLabel("Новый финиш задачи")).toHaveValue(targetDueDate);

    await page.goto("/projects/project-beta-school-renovation");
    await expect(page.getByLabel("Срок задачи Обмерить существующие классы")).toHaveValue(targetDueDate);
  });

  await test.step("my work opens the task and persists a comment", async () => {
    const comment = `Walkthrough комментарий ${Date.now()}`;

    await page.goto("/my-work");
    await expect(page).toHaveURL(/\/my-work$/);
    await expect(page.locator("body")).toContainText("Моя работа");

    await page.goto("/my-work?taskId=task-beta-school-survey");
    const taskDrawer = page.getByRole("dialog");
    await expect(taskDrawer.getByRole("heading", { level: 1, name: "Обмерить существующие классы" })).toBeVisible();
    await expect(taskDrawer.getByLabel("Срок задачи Обмерить существующие классы")).toHaveValue(targetDueDate);

    await taskDrawer.getByLabel("Комментарий к задаче").fill(comment);
    await taskDrawer.getByRole("button", { name: "Отправить" }).click();
    await expect(taskDrawer.getByText(comment)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("dialog").getByText(comment)).toBeVisible();
  });

  await test.step("global agent proposes and applies only after confirmation", async () => {
    const taskTitle = `Проверить итог walkthrough ${Date.now()}`;

    await page.goto("/agent");
    await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
    await page.getByLabel("Сообщение Генри Гантту").fill(`Создай задачу: ${taskTitle}`);
    await page.getByRole("button", { name: "Отправить сообщение" }).click();

    const proposal = page.locator(".runtime-agent-proposal").filter({ hasText: taskTitle });
    await expect(proposal).toContainText(`Будет создана задача: ${taskTitle}`);
    await expect(proposal.getByRole("link", { name: /Открыть результат действия/ })).toHaveCount(0);

    await proposal.getByRole("button", { name: "Применить" }).click();
    await expect(proposal).toContainText("Изменение применено");
    await expect(proposal).toContainText(/Записано в аудит:/);

    const resultLink = proposal.getByRole("link", { name: /Открыть результат действия/ });
    await expect(resultLink).toContainText(taskTitle);
    await resultLink.click();
    await expect(page).toHaveURL(/\/my-work\?taskId=task-[^&]+$/);
    await expect(page.getByRole("dialog", { name: taskTitle, exact: true })).toBeVisible();
  });

  await test.step("project resources must be a live runtime route for workload proof", async () => {
    await page.goto("/projects/project-beta-school-renovation/resources");
    await expect(page.getByRole("heading", { level: 1, name: /Ресурсы/ })).toBeVisible();
    await expect(page.locator('[data-row-id="role-missing-position-interior-designer"]')).toContainText(
      "Дизайнер интерьеров"
    );
    await expect(page.locator('[data-row-id="role-missing-position-interior-designer"]')).toContainText(
      "Не закрыта"
    );
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
    await expect(page.getByText("workspace.agent_action.applied").first()).toBeVisible();
  });
});
