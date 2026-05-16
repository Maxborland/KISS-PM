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

test("E2E-043 Finish-to-Start dependency persists and invalid date conflict returns typed blocker without partial mutation", async ({
  page,
  request
}) => {
  await resetPhase5Fixtures(request);
  const project = await seedScheduleProject(request);

  await openKissPm(page, "project-manager-a");
  await expect(page.getByTestId("gantt-status")).toContainText("Гантт загружен");
  await page.getByLabel("Предшественник FS").selectOption(phase5Seed.tenantA.validDependency.predecessorTaskId);
  await page.getByLabel("Последователь FS").selectOption(phase5Seed.tenantA.validDependency.successorTaskId);
  await page.getByRole("button", { name: "Создать FS-связь" }).click();

  await expect(page.getByTestId("gantt-status")).toContainText("FS-связь создана через API");
  await expect(page.getByTestId("gantt-action-evidence")).toContainText("Связь создана");
  await page.reload();
  await expect(page.getByTestId("gantt-action-evidence")).toContainText("Связь создана");
  const schedule = await getSchedule(request, project.id);
  expect(schedule.schedulePlan.dependencies).toContainEqual(
    expect.objectContaining({
      predecessorTaskId: phase5Seed.tenantA.validDependency.predecessorTaskId,
      successorTaskId: phase5Seed.tenantA.validDependency.successorTaskId,
      type: "finish_to_start"
    })
  );
  const audit = await getScheduleAudit(request, project.id);
  expect(audit.actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "schedule.dependency.create", status: "succeeded" })])
  );

  const invalid = await request.post(
    `${phase5ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/schedule/dependencies?testUser=project-manager-a`,
    {
      headers: { "content-type": "application/json" },
      data: phase5Seed.tenantA.invalidConflictDependency
    }
  );
  expect(invalid.status()).toBe(409);
  await expect(invalid.json()).resolves.toMatchObject({
    code: "precondition_failed",
    validationIssues: [
      expect.objectContaining({
        code: "finish_to_start_conflict",
        dependencyId: phase5Seed.tenantA.invalidConflictDependency.id
      })
    ]
  });

  const afterInvalid = await getSchedule(request, project.id);
  expect(afterInvalid.schedulePlan.dependencies.map((dependency) => dependency.id)).toEqual([
    `dependency-${phase5Seed.tenantA.validDependency.predecessorTaskId}-${phase5Seed.tenantA.validDependency.successorTaskId}`
  ]);
});
