import { expect, test, type Page } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

const PROJECT_ID = "project-demo-crm-intake";
const TASK_ID = "task-demo-resource-estimate";
const TASK_TITLE = "Подготовить ресурсную оценку по сделке";

const taskQuery = (path: string) =>
  new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?task=${TASK_ID}$`);

async function openTaskPeek(page: Page, accessibleName: string) {
  const trigger = page.getByRole("button", { name: accessibleName, exact: true }).first();
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await trigger.press("Enter");
  await expect(page.getByRole("dialog").getByRole("heading", { name: TASK_TITLE })).toBeVisible();
  return trigger;
}

test("canonical Task Peek opens from My Work, project and Gantt", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });

  await page.goto("/my-work");
  const myWorkTrigger = await openTaskPeek(page, `Открыть задачу «${TASK_TITLE}»`);
  await expect(page).toHaveURL(taskQuery("/my-work"));
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(myWorkTrigger).toBeFocused();

  await page.goto(`/projects/${PROJECT_ID}`);
  await openTaskPeek(page, `Открыть задачу «${TASK_TITLE}»`);
  await expect(page).toHaveURL(taskQuery(`/projects/${PROJECT_ID}`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`));
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto(`/projects/${PROJECT_ID}/schedule`);
  await openTaskPeek(page, `Открыть задачу «${TASK_TITLE}»`);
  await expect(page).toHaveURL(taskQuery(`/projects/${PROJECT_ID}/schedule`));
  await page.getByRole("link", { name: "Открыть полностью", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/tasks/${TASK_ID}$`));
  await expect(page.getByRole("heading", { name: TASK_TITLE })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Активность задачи" })).toBeVisible();
  await expect(page.getByText("20.05.2026", { exact: true })).toBeVisible();
  await expect(page.getByText(PROJECT_ID, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/task-status-/)).toHaveCount(0);
});

test("canonical task route persists edits and comments", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const title = `Task Peek E2E ${suffix}`;
  const editedTitle = `${title} edited`;
  const comment = `Комментарий Task Peek ${suffix}`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  const createResponse = await page.request.post(`/api/workspace/projects/${PROJECT_ID}/tasks`, {
    headers: { "x-kiss-pm-action": "same-origin" },
    data: {
      title,
      description: "Задача для проверки канонической карточки.",
      priority: "normal",
      statusId: "task-status-new",
      plannedStart: "2034-03-27",
      plannedFinish: "2034-03-29",
      durationWorkingDays: 3,
      plannedWork: 12,
      requiresAcceptance: false,
      participants: [
        { userId: "user-alpha-admin", role: "executor" },
        { userId: "user-alpha-admin", role: "requester" }
      ]
    }
  });
  expect(createResponse.status()).toBe(201);
  const created = (await createResponse.json()) as { task: { id: string } };

  await page.goto(`/tasks/${created.task.id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать задачу" });
  await editDialog.getByLabel("Название").fill(editedTitle);
  await editDialog.getByLabel("Трудозатраты").fill("14");
  const updateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/workspace/tasks/${created.task.id}`) &&
      response.request().method() === "PATCH"
  );
  await editDialog.getByRole("button", { name: "Сохранить задачу" }).click();
  const updateResponse = await updateResponsePromise;
  expect(
    updateResponse.status(),
    `Task update failed: ${await updateResponse.text()}`
  ).toBe(200);
  await expect(page.getByText("Задача обновлена.")).toBeVisible();
  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();

  await page.route(
    `**/api/workspace/tasks/${created.task.id}`,
    async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "task_version_conflict" })
        });
        return;
      }
      await route.fallback();
    },
    { times: 1 }
  );
  await page.getByRole("button", { name: "Редактировать", exact: true }).click();
  await editDialog.getByLabel("Название").fill(`${editedTitle} conflict`);
  await editDialog.getByRole("button", { name: "Сохранить задачу" }).click();
  await expect(
    editDialog.getByRole("alert").getByText("Задачу уже изменил другой участник.")
  ).toBeVisible();
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole("button", { name: "Отмена" }).click();

  await page
    .getByLabel("Комментарий")
    .fill(comment);
  await page.getByRole("button", { name: "Отправить комментарий" }).click();
  await expect(page.getByText(comment)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();
  await expect(page.getByText(comment)).toBeVisible();
});

test("canonical task route exposes loading, not-found, forbidden and retryable error states", async ({
  page
}) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });

  let releaseLoading: (() => void) | undefined;
  const loadingGate = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });
  await page.route("**/api/workspace/tasks/loading-task", async (route) => {
    await loadingGate;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "task_not_found" })
    });
  });
  await page.goto("/tasks/loading-task");
  await expect(page.getByText("Загрузка задачи…")).toBeVisible();
  releaseLoading?.();
  await expect(page.getByText("Задача не найдена", { exact: true })).toBeVisible();

  await page.route("**/api/workspace/tasks/forbidden-task", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "same_tenant_permission_required" })
    });
  });
  await page.goto("/tasks/forbidden-task");
  await expect(page.getByText("Доступ к задаче ограничен", { exact: true })).toBeVisible();

  let errorAttempts = 0;
  await page.route("**/api/workspace/tasks/error-task", async (route) => {
    errorAttempts += 1;
    await route.fulfill({
      status: errorAttempts === 1 ? 500 : 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: errorAttempts === 1 ? "test_failure" : "task_not_found"
      })
    });
  });
  await page.goto("/tasks/error-task");
  await expect(page.getByText("Не удалось загрузить задачу")).toBeVisible();
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("Задача не найдена", { exact: true })).toBeVisible();
});
