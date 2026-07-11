import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectAuditEventForSource,
  loginToWorkspace
} from "./smokeHelpers";

test("task workspace supports kanban creation, detail activity, drag status and bulk status", async ({
  page,
  request
}) => {
  const health = await request.get("/health");
  expect(health.status()).toBe(200);
  const suffix = Date.now().toString(36);
  const taskTitle = `Smoke task workspace ${suffix}`;
  const editedTaskTitle = `${taskTitle} edited`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  await page.getByRole("complementary").getByRole("button", { name: "Моя работа" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("heading", { name: "Мои задачи" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Канбан", exact: true }).click();
  const waitingColumn = getKanbanColumn(page, "Ожидает");
  await expect(waitingColumn).toBeVisible();
  await waitingColumn.getByRole("button", { name: "+ Добавить задачу" }).click();

  const createDialog = page.getByRole("dialog", { name: "Создать задачу" });
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Название").fill(taskTitle);
  await createDialog.getByLabel("Проект").selectOption({ label: "CRM intake" });
  await createDialog.getByLabel("Начало").fill("27.03.2034");
  await createDialog.getByLabel("Окончание").fill("29.03.2034");
  await createDialog.getByLabel("Длительность").fill("3");
  await createDialog.getByLabel("Трудозатраты").fill("12");
  await createDialog.getByRole("button", { name: "Создать и открыть" }).click();

  await expect(page).toHaveURL(/\/tasks\/task-/);
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  const taskId = page.url().split("/tasks/")[1] ?? "";
  expect(taskId).toMatch(/^task-/);
  await expect(page.getByRole("heading", { name: "Активность задачи" })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать задачу" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel("Название").fill(editedTaskTitle);
  await editDialog.getByLabel("Трудозатраты").fill("14");
  await editDialog.getByRole("button", { name: "Сохранить задачу" }).click();
  await expect(page.getByText("Задача обновлена.")).toBeVisible();
  await expect(page.getByRole("heading", { name: editedTaskTitle })).toBeVisible();
  await page
    .getByLabel("Комментарий")
    .first()
    .fill(`Комментарий по задаче ${suffix}`);
  await page.getByRole("button", { name: "Отправить комментарий" }).first().click();
  await expect(page.getByText(`Комментарий по задаче ${suffix}`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Комментарий по задаче ${suffix}`)).toBeVisible();

  await page.getByRole("complementary").getByRole("button", { name: "Моя работа" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await page.getByRole("button", { name: "Канбан", exact: true }).click();
  await page.getByPlaceholder("Поиск задачи...").fill(editedTaskTitle);
  const filteredWaitingColumn = getKanbanColumn(page, "Ожидает");
  const inProgressColumn = getKanbanColumn(page, "В работе");
  await expect(filteredWaitingColumn.getByText(editedTaskTitle)).toBeVisible();
  await dragTaskToColumn(page, {
    sourceColumn: filteredWaitingColumn,
    taskTitle: editedTaskTitle,
    targetColumn: inProgressColumn
  });
  await expect(inProgressColumn.getByText(editedTaskTitle)).toBeVisible();

  await page.getByRole("button", { name: "Таблица", exact: true }).click();
  const taskRow = page.getByRole("row", { name: new RegExp(escapeRegExp(editedTaskTitle)) });
  await expect(taskRow).toBeVisible();
  await page.getByRole("button", { name: "Включить массовый режим" }).click();
  await taskRow.getByRole("checkbox", { name: new RegExp(escapeRegExp(taskTitle)) }).check();
  await page.getByLabel("Массовая смена статуса").selectOption({ label: "Ожидает" });
  await expect(taskRow.getByText("Ожидает")).toBeVisible();

  await expectAuditEventForSource(page, {
    actionType: "task.created",
    sourceEntityId: taskId,
    sourceEntityType: "Task"
  });
  await expectAuditEventForSource(page, {
    actionType: "task.updated",
    sourceEntityId: taskId,
    sourceEntityType: "Task"
  });
  await expectAuditEventForSource(page, {
    actionType: "task.comment_created",
    sourceEntityId: taskId,
    sourceEntityType: "Task"
  });
  await expectAuditEventForSource(page, {
    actionType: "task.status_changed",
    sourceEntityId: taskId,
    sourceEntityType: "Task"
  });
});

function getKanbanColumn(page: Page, statusName: string): Locator {
  return page.locator(".task-kanban-column").filter({
    has: page.locator("header").filter({ hasText: statusName })
  });
}

async function dragTaskToColumn(
  page: Page,
  input: { sourceColumn: Locator; taskTitle: string; targetColumn: Locator }
) {
  const dragHandle = input.sourceColumn.getByRole("button", {
    name: new RegExp(`Переместить задачу ${escapeRegExp(input.taskTitle)}`)
  });
  const target = input.targetColumn.locator(".task-kanban-cards");
  const dragBox = await dragHandle.boundingBox();
  const targetBox = await target.boundingBox();
  expect(dragBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(
    dragBox!.x + dragBox!.width / 2,
    dragBox!.y + dragBox!.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + 24,
    { steps: 10 }
  );
  await page.mouse.up();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
