import { expect, test } from "@playwright/test";

import {
  getAuditEvents,
  getManagedProject,
  openProjectWorkSurface,
  phase4ProjectId,
  resetPhase4Fixtures
} from "./helpers";

test("E2E-031 User moves project stage through required checks", async ({ page, request }) => {
  await resetPhase4Fixtures(request);
  await openProjectWorkSurface(page, "project-manager-a");
  await page.getByRole("button", { name: "Создать управляемый проект" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Управляемый проект создан");

  await page.getByRole("button", { name: "Перейти к следующей стадии" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Есть блокеры перехода");

  await page.getByRole("button", { name: "Принять паспорт проекта" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Артефакт принят");
  await expect(page.getByTestId("artifact-evidence")).toContainText("artifact-phase4-charter: accepted");

  await page.getByRole("button", { name: "Согласовать паспорт" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Согласование принято");
  await expect(page.getByTestId("approval-evidence")).toContainText("approval-phase4-charter: approved");

  await page.getByRole("button", { name: "Перейти к следующей стадии" }).click();
  await expect(page.getByTestId("project-work-status")).toContainText("Стадия переведена");
  await expect(page.getByTestId("stage-progress")).toContainText("Инициация: Завершена");
  await expect(page.getByTestId("stage-progress")).toContainText("Исполнение: Активна");

  const project = await getManagedProject(request);
  expect(project.currentStageId).toBe(`${phase4ProjectId}:stage-delivery`);
  expect(project.stages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ templateKey: "initiation", status: "completed" }),
      expect.objectContaining({ templateKey: "delivery", status: "active" })
    ])
  );
  const audit = await getAuditEvents(request, "project", phase4ProjectId);
  expect(audit.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actorId: "project-manager-a",
        actionKey: "project.lifecycle.advance_stage"
      })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("stage-progress")).toContainText("Исполнение: Активна");
});
