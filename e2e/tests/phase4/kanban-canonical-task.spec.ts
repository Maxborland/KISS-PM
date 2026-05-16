import { expect, test } from "@playwright/test";

import {
  createManagedProject,
  createPhase4Task,
  getAuditEvents,
  getKanbanTask,
  getManagedProject,
  openProjectWorkSurface,
  phase4ProjectId,
  phase4TaskId,
  resetPhase4Fixtures
} from "./helpers";

test("E2E-034 Kanban status change updates the same canonical task", async ({ page, request }) => {
  await resetPhase4Fixtures(request);
  const project = await createManagedProject(request);
  await createPhase4Task(request, project);

  await openProjectWorkSurface(page, "project-manager-a");
  await expect(page.getByTestId("project-task-list")).toContainText(`${phase4TaskId}:`);
  await expect(page.getByTestId("kanban-column-todo")).toContainText(phase4TaskId);

  await page.getByTestId("kanban-column-todo").getByRole("button", { name: "В работу" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Статус задачи изменен");
  await expect(page.getByTestId("project-task-list")).toContainText(`${phase4TaskId}: Провести старт проекта / В работе`);
  await expect(page.getByTestId("kanban-column-in_progress")).toContainText(phase4TaskId);
  await expect(page.getByTestId("task-audit-events")).toContainText(`task.status.change: project-manager-a - ${phase4TaskId}`);

  await page.getByTestId("kanban-column-in_progress").getByRole("button", { name: "Комментарий" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Комментарий добавлен");
  await expect(page.getByTestId("task-audit-events")).toContainText(`task.comment.add: project-manager-a - ${phase4TaskId}`);

  const kanbanTask = await getKanbanTask(request);
  expect(kanbanTask).toEqual(
    expect.objectContaining({
      id: phase4TaskId,
      projectId: phase4ProjectId,
      status: "in_progress"
    })
  );
  const canonicalProject = await getManagedProject(request);
  expect(canonicalProject.tasks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: phase4TaskId,
        projectId: phase4ProjectId,
        status: "in_progress"
      })
    ])
  );
  const audit = await getAuditEvents(request, "task", phase4TaskId);
  expect(audit.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ actionKey: "task.status.change", actorId: "project-manager-a" }),
      expect.objectContaining({ actionKey: "task.comment.add", actorId: "project-manager-a" })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("project-task-list")).toContainText(`${phase4TaskId}: Провести старт проекта / В работе`);
  await expect(page.getByTestId("kanban-column-in_progress")).toContainText(phase4TaskId);
  await expect(page.getByTestId("task-audit-events")).toContainText("task.status.change");
});
