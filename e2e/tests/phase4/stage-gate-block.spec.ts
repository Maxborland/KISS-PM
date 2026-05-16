import { expect, test } from "@playwright/test";

import {
  createManagedProject,
  getManagedProject,
  openProjectWorkSurface,
  phase4ApiBaseUrl,
  phase4ProjectId,
  resetPhase4Fixtures
} from "./helpers";

test("E2E-032 Stage cannot close when required artifact/approval is missing", async ({ page, request }) => {
  await resetPhase4Fixtures(request);
  const project = await createManagedProject(request);

  await openProjectWorkSurface(page, "project-manager-a");
  await expect(page.getByTestId("managed-project-title")).toContainText("Внедрение портала АКМЕ");
  await page.getByRole("button", { name: "Перейти к следующей стадии" }).click();

  await expect(page.getByTestId("project-work-status")).toContainText("Есть блокеры перехода");
  await expect(page.getByTestId("stage-gate-blockers")).toContainText("missing_required_artifact");
  await expect(page.getByTestId("stage-gate-blockers")).toContainText("required_approval_not_approved");

  const blockedResponse = await request.post(
    `${phase4ApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/stages/${encodeURIComponent(
      project.currentStageId
    )}/transition?testUser=project-manager-a`,
    { data: { transition: "advance_stage" }, headers: { "content-type": "application/json" } }
  );
  expect(blockedResponse.status()).toBe(409);
  await expect(blockedResponse.json()).resolves.toEqual(
    expect.objectContaining({
      code: "precondition_failed",
      transitionError: expect.objectContaining({
        code: "stage_gate_blocked",
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "missing_required_artifact" }),
          expect.objectContaining({ code: "required_approval_not_approved" })
        ])
      })
    })
  );

  const unchangedProject = await getManagedProject(request);
  expect(unchangedProject.currentStageId).toBe(`${phase4ProjectId}:stage-initiation`);

  await page.reload();
  await expect(page.getByTestId("stage-progress")).toContainText("Инициация: Активна");
});
