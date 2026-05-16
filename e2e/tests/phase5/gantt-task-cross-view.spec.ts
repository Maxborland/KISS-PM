import { expect, test } from "@playwright/test";

import {
  createScheduleTask,
  getKanbanTaskIds,
  getSchedule,
  getScheduleAudit,
  listMyExecutorTasks,
  listProjectTasks,
  openKissPm,
  phase5Seed,
  resetPhase5Fixtures,
  seedScheduleProject
} from "./helpers";

test("E2E-041 schedule-created canonical tasks are visible through Gantt, project task, My Tasks, and Kanban readbacks", async ({
  page,
  request
}) => {
  const uiCreatedTaskId = "task-phase5-e2e-ui-created";
  const assignedTask = {
    ...phase5Seed.tenantA.tasks[2],
    id: "task-phase5-e2e-assigned"
  };
  await resetPhase5Fixtures(request);
  const project = await seedScheduleProject(request);

  await openKissPm(page, "project-manager-a");
  await expect(page.getByTestId("gantt-status")).toContainText("Гантт загружен");
  await page.getByLabel("ID новой задачи").fill(uiCreatedTaskId);
  await page.getByLabel("Старт новой задачи").fill("2026-06-11");
  await page.getByLabel("Финиш новой задачи").fill("2026-06-12");
  await page.getByRole("button", { name: "Создать задачу в Гантте" }).click();

  await expect(page.getByTestId("gantt-status")).toContainText("Задача создана через API");
  await expect(page.getByTestId(`gantt-row-${uiCreatedTaskId}`)).toContainText(uiCreatedTaskId);
  await page.reload();
  await expect(page.getByTestId(`gantt-row-${uiCreatedTaskId}`)).toContainText(uiCreatedTaskId);

  const schedule = await getSchedule(request, project.id);
  expect(schedule.schedulePlan.wbsNodes.map((node) => node.taskId)).toContain(uiCreatedTaskId);
  await expect.poll(async () => (await listProjectTasks(request, project.id)).map((task) => task.id)).toContain(uiCreatedTaskId);
  await expect.poll(async () => await getKanbanTaskIds(request, project.id)).toContain(uiCreatedTaskId);
  const auditAfterUiCreate = await getScheduleAudit(request, project.id);
  expect(auditAfterUiCreate.actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        commandType: "schedule.task.create",
        target: expect.objectContaining({ entityType: "task", entityId: uiCreatedTaskId })
      })
    ])
  );

  // Current Gantt UI does not expose participant assignment yet, so My Tasks identity is
  // proven through the same schedule-backed create command with explicit participants.
  await createScheduleTask(request, project, assignedTask, {
    participants: [
      { id: "participant-phase5-assigned-executor", userId: "executor-a", role: "executor" },
      { id: "participant-phase5-assigned-controller", userId: "project-manager-a", role: "controller" }
    ]
  });
  await expect.poll(async () => (await listMyExecutorTasks(request)).map((task) => task.id)).toContain(assignedTask.id);

  await openKissPm(page, "executor-a");
  await expect(page.getByTestId("my-tasks-list")).toContainText(assignedTask.id);
  await expect(page.getByTestId("kanban-column-todo")).toContainText(uiCreatedTaskId);
});
