import { expect, test } from "@playwright/test";

import { getSchedule, getScheduleAudit, openKissPm, phase5Seed, resetPhase5Fixtures, seedScheduleProject } from "../phase5/helpers";

test("E2E-R2-002 Project Gantt: Excel-like edit persists, audit appears, reload keeps state", async ({ page, request }) => {
  const taskId = phase5Seed.tenantA.tasks[0]!.id;
  await resetPhase5Fixtures(request);
  const project = await seedScheduleProject(request);

  await openKissPm(page, "project-manager-a");
  await expect(page.getByTestId("gantt-status")).toContainText("Гантт загружен");
  await page.getByLabel(`Старт ${taskId}`).fill("2026-06-02");
  await page.getByLabel(`Финиш ${taskId}`).fill("2026-06-04");
  await page.getByLabel(`Работа ${taskId}`).fill("14");
  await page.getByLabel(`Прогресс ${taskId}`).fill("40");
  await page.getByRole("button", { name: `Сохранить ${taskId}` }).click();
  await expect(page.getByTestId("gantt-status")).toContainText("Расписание задачи сохранено через API");

  await page.reload();
  await expect(page.getByLabel(`Старт ${taskId}`)).toHaveValue("2026-06-02");
  await expect(page.getByLabel(`Финиш ${taskId}`)).toHaveValue("2026-06-04");
  expect((await getSchedule(request, project.id)).schedulePlan.wbsNodes).toContainEqual(
    expect.objectContaining({
      taskId,
      schedule: expect.objectContaining({ plannedStartDate: "2026-06-02", plannedFinishDate: "2026-06-04" }),
      plannedWorkHours: 14,
      progressPercent: 40
    })
  );
  expect((await getScheduleAudit(request, project.id)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "schedule.task.update", status: "succeeded" })])
  );
});

test("E2E-R2-003 Project Gantt tracking: baseline remains stable, live changes show variance", async ({ page, request }) => {
  const taskId = phase5Seed.tenantA.liveDrift.taskId;
  const originalTask = phase5Seed.tenantA.tasks.find((task) => task.id === taskId)!;
  await resetPhase5Fixtures(request);
  const project = await seedScheduleProject(request);

  await openKissPm(page, "project-manager-a");
  await page.getByRole("button", { name: "Зафиксировать базовый план" }).click();
  await expect(page.getByTestId("gantt-status")).toContainText("Базовый план зафиксирован через API");

  await page.getByLabel(`Старт ${taskId}`).fill(phase5Seed.tenantA.liveDrift.plannedStartDate);
  await page.getByLabel(`Финиш ${taskId}`).fill(phase5Seed.tenantA.liveDrift.plannedFinishDate);
  await page.getByLabel(`Работа ${taskId}`).fill(String(phase5Seed.tenantA.liveDrift.plannedWorkHours));
  await page.getByLabel(`Прогресс ${taskId}`).fill(String(phase5Seed.tenantA.liveDrift.progressPercent));
  await page.getByRole("button", { name: `Сохранить ${taskId}` }).click();

  await page.reload();
  await expect(page.getByTestId(`gantt-row-${taskId}`)).toContainText(
    `${originalTask.plannedStartDate} / ${originalTask.plannedFinishDate} / 3 / ${originalTask.progressPercent}%`
  );
  const schedule = await getSchedule(request, project.id);
  expect(schedule.baseline?.taskBaselineValues).toContainEqual(
    expect.objectContaining({
      taskId,
      plannedStartDate: originalTask.plannedStartDate,
      plannedFinishDate: originalTask.plannedFinishDate
    })
  );
  expect(schedule.schedulePlan.wbsNodes).toContainEqual(
    expect.objectContaining({
      taskId,
      schedule: expect.objectContaining({
        plannedStartDate: phase5Seed.tenantA.liveDrift.plannedStartDate,
        plannedFinishDate: phase5Seed.tenantA.liveDrift.plannedFinishDate
      })
    })
  );
});
