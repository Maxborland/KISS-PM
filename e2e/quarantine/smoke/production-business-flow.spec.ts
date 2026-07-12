import type { Page } from "@playwright/test";
import { expect, test } from "../../runtime/runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

type Task = {
  id: string;
  projectId: string;
  title: string;
  statusId: string;
  statusCategory: string;
};

type TaskStatus = {
  id: string;
  name: string;
  category: string;
  sortOrder: number;
  status: string;
};

test("project-management path persists governed task, blocker, planning and audit proof", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(adminCredentials.email);
  await page.getByLabel("Пароль").fill(adminCredentials.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const beforeTasks = await readMyWork(page);
  const statuses = await readTaskStatuses(page);
  const task = beforeTasks.find((item) => item.statusCategory !== "done") ?? beforeTasks[0];
  if (!task) throw new Error("seeded_task_missing");
  const next = nextStatus(statuses, task);
  const waiting = statuses.find((status) => status.category === "waiting" && status.status !== "archived");
  if (!waiting) throw new Error("waiting_status_missing");

  await page.goto("/my-work");
  await page.getByText("Список", { exact: true }).click();
  const taskRow = page.getByRole("row", { name: new RegExp(escapeRegExp(task.title)) });
  await taskRow.getByRole("button", { name: `→ ${next.name}` }).click();
  await expect(page.getByText("Статус задачи сохранён")).toBeVisible();
  await page.reload();

  const afterTasks = await readMyWork(page);
  const updatedTask = afterTasks.find((item) => item.id === task.id);
  expect(updatedTask?.statusId).toBe(next.id);

  await page.getByText("Список", { exact: true }).click();
  const blockerTask = afterTasks.find((item) => item.statusCategory !== "done") ?? updatedTask;
  if (!blockerTask) throw new Error("blocker_task_missing");
  await page.getByLabel(`Комментарий к задаче ${blockerTask.title}`).fill("Не хватает ресурсного окна");
  await page.getByRole("row", { name: new RegExp(escapeRegExp(blockerTask.title)) }).getByRole("button", { name: "Блокер" }).click();
  await expect(page.getByText("Блокер зафиксирован")).toBeVisible();
  const blockedTasks = await readMyWork(page);
  expect(blockedTasks.find((item) => item.id === blockerTask.id)?.statusId).toBe(waiting.id);

  const project = await firstProject(page);
  const newTaskTitle = `Проверить рабочий сценарий ${Date.now()}`;
  await page.goto(`/projects/${project.id}`);
  await page.getByLabel("Название задачи").fill(newTaskTitle);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByText("Задача создана")).toBeVisible();
  await expectProjectTask(page, project.id, newTaskTitle);

  const beforePlan = await readPlanVersion(page, project.id);
  await page.goto(`/projects/${project.id}/timeline`);
  await page.getByRole("button", { name: "Подготовить сверку" }).click();
  await expect(page.getByText("Сверка изменения")).toBeVisible();
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByText("Изменение плана применено")).toBeVisible();
  expect(await readPlanVersion(page, project.id)).toBeGreaterThan(beforePlan);

  const auditResponse = await page.request.get("/api/tenant/current/audit-events?limit=50");
  expect(auditResponse.status()).toBe(200);
  const auditPayload = (await auditResponse.json()) as {
    auditEvents: Array<{ actionType: string; sourceEntity?: { id?: string } }>;
  };
  expect(
    auditPayload.auditEvents.some(
      (event) => event.actionType === "task.status_changed" && event.sourceEntity?.id === task.id
    )
  ).toBe(true);
  expect(auditPayload.auditEvents.some((event) => event.actionType === "task.comment_created")).toBe(true);
  expect(auditPayload.auditEvents.some((event) => event.actionType === "planning.task.updated")).toBe(true);
});

test("agent proposal requires confirmation before applying a persisted action", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(adminCredentials.email);
  await page.getByLabel("Пароль").fill(adminCredentials.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const beforeTasks = await readMyWork(page);
  const candidate = beforeTasks.find((item) => item.statusCategory !== "done");
  if (!candidate) throw new Error("agent_candidate_missing");

  await page.goto("/agent");
  await page.getByRole("button", { name: "Подготовить предложение" }).click();
  await expect(page.getByText("Подтвердите действие")).toBeVisible();
  expect((await readMyWork(page)).find((item) => item.id === candidate.id)?.statusId).toBe(candidate.statusId);

  await page.getByRole("button", { name: "Подтвердить действие" }).click();
  await expect(page.getByText("Предложение применено")).toBeVisible();
  expect((await readMyWork(page)).find((item) => item.id === candidate.id)?.statusId).not.toBe(candidate.statusId);
});

async function readMyWork(page: Page) {
  const response = await page.request.get("/api/workspace/my-work");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { tasks: Task[] };
  return payload.tasks;
}

async function readTaskStatuses(page: Page) {
  const response = await page.request.get("/api/workspace/task-statuses");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { taskStatuses: TaskStatus[] };
  return payload.taskStatuses;
}

async function firstProject(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { projects: Array<{ id: string }> };
  const project = payload.projects[0];
  if (!project) throw new Error("seeded_project_missing");
  return project;
}

async function expectProjectTask(page: Page, projectId: string, title: string) {
  const response = await page.request.get(`/api/workspace/projects/${projectId}`);
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { tasks: Array<{ title: string }> };
  expect(payload.tasks.some((task) => task.title === title)).toBe(true);
}

async function readPlanVersion(page: Page, projectId: string) {
  const response = await page.request.get(`/api/workspace/projects/${projectId}/planning/read-model`);
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { planVersion: number };
  return payload.planVersion;
}

function nextStatus(statuses: TaskStatus[], task: Task): TaskStatus {
  const active = statuses.filter((status) => status.status !== "archived").sort((left, right) => left.sortOrder - right.sortOrder);
  const index = active.findIndex((status) => status.id === task.statusId || status.category === task.statusCategory);
  const candidate = active[index + 1];
  if (!candidate) throw new Error("next_status_missing");
  return candidate;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
