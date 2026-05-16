import { expect, test } from "@playwright/test";

import {
  getAuditEvents,
  getManagedProject,
  openProjectWorkSurface,
  phase4ProjectId,
  resetPhase4Fixtures
} from "./helpers";

test("E2E-030 User creates project from process template", async ({ page, request }) => {
  await resetPhase4Fixtures(request);
  await openProjectWorkSurface(page, "project-manager-a");

  await expect(page.getByTestId("project-work-status")).toContainText("Проект еще не создан");
  await page.getByRole("button", { name: "Создать управляемый проект" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Управляемый проект создан");
  await expect(page.getByTestId("managed-project-title")).toContainText("Внедрение портала АКМЕ");
  await expect(page.getByTestId("stage-progress")).toContainText("Инициация: Активна");
  await expect(page.getByTestId("stage-progress")).toContainText("Исполнение: Ожидает");

  const project = await getManagedProject(request);
  expect(project).toEqual(
    expect.objectContaining({
      id: phase4ProjectId,
      tenantId: "tenant-a",
      currentStageId: `${phase4ProjectId}:stage-initiation`
    })
  );
  expect(project.processTemplateSnapshot.stageTemplates.map((stage) => stage.key)).toEqual(["initiation", "delivery"]);

  const audit = await getAuditEvents(request, "project", phase4ProjectId);
  expect(audit.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actorId: "project-manager-a",
        actionKey: "project.create_from_template",
        target: { entityType: "project", entityId: phase4ProjectId }
      })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("project-work-surface")).toBeVisible();
  await expect(page.getByTestId("managed-project-title")).toContainText("Внедрение портала АКМЕ");

  await resetPhase4Fixtures(request);
  await openProjectWorkSurface(page, "readonly-observer-a");
  await page.getByRole("button", { name: "Проверить запрет создания проекта" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Доступ запрещен");
});
