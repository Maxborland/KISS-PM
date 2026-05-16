import { expect, test } from "@playwright/test";

import { openKissPm, phase5ApiBaseUrl, phase5Seed, resetPhase5Fixtures, seedScheduleProject } from "./helpers";

test("E2E-040 project manager opens selected project Gantt with tenant isolation and read-only denial", async ({
  page,
  request
}) => {
  await resetPhase5Fixtures(request);
  const project = await seedScheduleProject(request);
  const tenantBProject = await seedScheduleProject(request, phase5Seed.tenantB, "tenant-admin-b");

  await openKissPm(page, "project-manager-a");
  await expect(page.getByTestId("project-work-surface")).toBeVisible();
  await page.getByRole("button", { name: "Открыть Гантт проекта" }).click();

  await expect(page.getByTestId("gantt-status")).toContainText("Гантт загружен");
  await expect(page.getByLabel(`Старт ${phase5Seed.tenantA.tasks[0].id}`)).toHaveValue("2026-06-01");
  await expect(page.getByTestId("gantt-bars")).toContainText(phase5Seed.tenantA.tasks[1].id);

  const tenantBRead = await request.get(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/schedule?testUser=tenant-admin-b`
  );
  expect(tenantBRead.status()).toBe(404);
  const tenantAReadPrivateTenantB = await request.get(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(tenantBProject.id)}/schedule?testUser=project-manager-a`
  );
  expect(tenantAReadPrivateTenantB.status()).toBe(404);
  await expect(page.getByTestId("gantt-surface")).not.toContainText(phase5Seed.tenantB.tasks[0].id);

  await openKissPm(page, "readonly-observer-a");
  await expect(page.getByTestId("gantt-status")).toContainText("Гантт загружен");
  await expect(page.getByTestId("gantt-command-denied")).toContainText("Изменение расписания недоступно");
  await expect(page.getByRole("button", { name: "Создать задачу в Гантте" })).toHaveCount(0);

  const deniedWrite = await request.post(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/schedule/tasks?testUser=readonly-observer-a`,
    {
      headers: { "content-type": "application/json" },
      data: {
        id: "task-phase5-readonly-denied",
        stageId: project.currentStageId,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        plannedStartDate: "2026-06-15",
        plannedFinishDate: "2026-06-16",
        plannedWorkHours: 8,
        progressPercent: 0
      }
    }
  );
  expect(deniedWrite.status()).toBe(403);
});
