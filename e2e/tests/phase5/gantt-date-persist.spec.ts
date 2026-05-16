import { expect, test } from "@playwright/test";

import {
  getSchedule,
  getScheduleAudit,
  openKissPm,
  phase5ApiBaseUrl,
  phase5Seed,
  resetPhase5Fixtures,
  seedScheduleProject
} from "./helpers";

test("E2E-042 planned date, work, and progress edits persist, audit, and reject invalid ranges without mutation", async ({
  page,
  request
}) => {
  const taskId = phase5Seed.tenantA.tasks[0].id;
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
  await expect(page.getByTestId(`gantt-row-${taskId}`)).toContainText("3");

  const schedule = await getSchedule(request, project.id);
  expect(schedule.schedulePlan.wbsNodes).toContainEqual(
    expect.objectContaining({
      taskId,
      schedule: expect.objectContaining({ plannedStartDate: "2026-06-02", plannedFinishDate: "2026-06-04" }),
      plannedWorkHours: 14,
      progressPercent: 40
    })
  );
  const audit = await getScheduleAudit(request, project.id);
  expect(audit.actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "schedule.task.update", status: "succeeded" })])
  );

  const invalidPatch = await request.patch(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/schedule/tasks/${encodeURIComponent(
      taskId
    )}?testUser=project-manager-a`,
    {
      headers: { "content-type": "application/json" },
      data: {
        plannedStartDate: "2026-06-10",
        plannedFinishDate: "2026-06-09",
        plannedWorkHours: 14,
        progressPercent: 40
      }
    }
  );
  expect(invalidPatch.status()).toBe(400);
  const afterInvalid = await getSchedule(request, project.id);
  expect(afterInvalid.schedulePlan.wbsNodes).toContainEqual(
    expect.objectContaining({
      taskId,
      schedule: expect.objectContaining({ plannedStartDate: "2026-06-02", plannedFinishDate: "2026-06-04" })
    })
  );
});
