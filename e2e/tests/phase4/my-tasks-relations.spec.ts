import { expect, test } from "@playwright/test";

import {
  createManagedProject,
  createPhase4Task,
  listMyTasks,
  openProjectWorkSurface,
  phase4TaskId,
  resetPhase4Fixtures
} from "./helpers";

test("E2E-033 Task appears in My Tasks for executor and controlled tasks for controller/requester", async ({
  page,
  request
}) => {
  await resetPhase4Fixtures(request);
  const project = await createManagedProject(request);
  await createPhase4Task(request, project);

  await openProjectWorkSurface(page, "project-manager-a");
  await expect(page.getByTestId("project-task-list")).toContainText(phase4TaskId);
  await expect(page.getByTestId("controlled-tasks-list")).toContainText(`${phase4TaskId}:`);
  await expect(page.getByTestId("controlled-tasks-list")).toContainText("контролер");
  await expect(page.getByTestId("my-tasks-list")).toContainText("У исполнителя пока нет задач");

  const executorTasks = await listMyTasks(request, "executor-a", "executor");
  expect(executorTasks.tasks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: phase4TaskId,
        relationRoles: ["executor"]
      })
    ])
  );

  await openProjectWorkSurface(page, "executor-a");
  await expect(page.getByTestId("my-tasks-list")).toContainText(`${phase4TaskId}:`);
  await expect(page.getByTestId("my-tasks-list")).toContainText("исполнитель");

  await page.reload();
  await expect(page.getByTestId("my-tasks-list")).toContainText(`${phase4TaskId}:`);
});
