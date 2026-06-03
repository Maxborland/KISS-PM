import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project task status mutation is visible in scoped audit projection", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const projectId = "project-beta-school-renovation";
  const taskId = "task-beta-school-survey";
  const taskTitle = "Обмерить существующие классы";

  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();

  const taskRow = page.getByRole("row", { name: new RegExp(taskTitle) });
  await expect(taskRow).toBeVisible();
  const currentText = await taskRow.textContent();
  const targetStatus = currentText?.includes("На контроле") ? "В работе" : "На контроле";

  await taskRow.getByLabel(`Статус задачи ${taskTitle}`).click();
  await page.getByRole("option", { name: targetStatus }).click();
  await expect(taskRow).toContainText(targetStatus);

  const auditResponse = await page.request.get(`/api/tenant/current/audit-events?projectId=${projectId}`);
  expect(auditResponse.status()).toBe(200);
  const auditBody = (await auditResponse.json()) as {
    auditEvents: Array<{
      actionType: string;
      sourceEntity: { type: string; id: string };
    }>;
  };
  expect(auditBody.auditEvents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actionType: "task.status_changed",
        sourceEntity: { type: "Task", id: taskId }
      })
    ])
  );

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { level: 1, name: "Аудит действий" })).toBeVisible();
  const auditRow = page.getByText("task.status_changed").first().locator("xpath=ancestor::li[1]");
  await expect(auditRow).toContainText(`Task:${taskId}`);
});
