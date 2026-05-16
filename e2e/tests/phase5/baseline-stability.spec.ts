import { expect, test } from "@playwright/test";

import { getSchedule, getScheduleAudit, openKissPm, phase5Seed, resetPhase5Fixtures, seedScheduleProject } from "./helpers";

test("E2E-044 baseline draft remains stable after live schedule drift", async ({ page, request }) => {
  const taskId = phase5Seed.tenantA.liveDrift.taskId;
  const originalTask = phase5Seed.tenantA.tasks.find((task) => task.id === taskId);
  expect(originalTask).toBeDefined();

  await resetPhase5Fixtures(request);
  const project = await seedScheduleProject(request);

  await openKissPm(page, "project-manager-a");
  await expect(page.getByTestId("gantt-status")).toContainText("Гантт загружен");
  await page.getByRole("button", { name: "Зафиксировать базовый план" }).click();
  await expect(page.getByTestId("gantt-status")).toContainText("Базовый план зафиксирован через API");
  await expect(page.getByTestId(`gantt-row-${taskId}`)).toContainText(
    `${originalTask?.plannedStartDate} / ${originalTask?.plannedFinishDate} / 3 / ${originalTask?.progressPercent}%`
  );

  await page.getByLabel(`Старт ${taskId}`).fill(phase5Seed.tenantA.liveDrift.plannedStartDate);
  await page.getByLabel(`Финиш ${taskId}`).fill(phase5Seed.tenantA.liveDrift.plannedFinishDate);
  await page.getByLabel(`Работа ${taskId}`).fill(String(phase5Seed.tenantA.liveDrift.plannedWorkHours));
  await page.getByLabel(`Прогресс ${taskId}`).fill(String(phase5Seed.tenantA.liveDrift.progressPercent));
  await page.getByRole("button", { name: `Сохранить ${taskId}` }).click();

  await expect(page.getByTestId("gantt-status")).toContainText("Расписание задачи сохранено через API");
  await page.reload();
  await expect(page.getByLabel(`Старт ${taskId}`)).toHaveValue(phase5Seed.tenantA.liveDrift.plannedStartDate);
  await expect(page.getByLabel(`Финиш ${taskId}`)).toHaveValue(phase5Seed.tenantA.liveDrift.plannedFinishDate);
  await expect(page.getByTestId(`gantt-row-${taskId}`)).toContainText(
    `${originalTask?.plannedStartDate} / ${originalTask?.plannedFinishDate} / 3 / ${originalTask?.progressPercent}%`
  );

  const schedule = await getSchedule(request, project.id);
  expect(schedule.baseline?.taskBaselineValues).toContainEqual(
    expect.objectContaining({
      taskId,
      plannedStartDate: originalTask?.plannedStartDate,
      plannedFinishDate: originalTask?.plannedFinishDate,
      progressPercent: originalTask?.progressPercent
    })
  );
  expect(schedule.schedulePlan.wbsNodes).toContainEqual(
    expect.objectContaining({
      taskId,
      schedule: expect.objectContaining({
        plannedStartDate: phase5Seed.tenantA.liveDrift.plannedStartDate,
        plannedFinishDate: phase5Seed.tenantA.liveDrift.plannedFinishDate
      }),
      progressPercent: phase5Seed.tenantA.liveDrift.progressPercent
    })
  );
  const audit = await getScheduleAudit(request, project.id);
  expect(audit.actionExecutions.map((action) => action.commandType)).toEqual(
    expect.arrayContaining(["schedule.baseline.capture", "schedule.task.update"])
  );
});
