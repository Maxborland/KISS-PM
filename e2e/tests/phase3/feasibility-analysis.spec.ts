import { expect, test } from "@playwright/test";

import { openCrmIntakeSurface, phase3ApiBaseUrl, resetPhase3Fixtures } from "./helpers";

test("E2E-022 Resource manager runs demand and capacity feasibility from CRM Intake Control", async ({
  page,
  request
}) => {
  await resetPhase3Fixtures(request);
  await openCrmIntakeSurface(page, "resource-manager-a");

  await expect(page.getByTestId("opportunity-list")).toContainText("Внедрение портала АКМЕ");
  await page.getByRole("button", { name: "Проверить готовность" }).click();
  await expect(page.getByTestId("readiness-next-action")).toContainText("Запустить оценку реализуемости");

  await page.getByRole("button", { name: "Рассчитать реализуемость" }).click();
  await expect(page.getByTestId("feasibility-status")).toContainText("fit / warning");
  await expect(page.getByTestId("demand-summary")).toContainText("Руководитель проекта");
  await expect(page.getByTestId("demand-summary")).toContainText("Архитектор решения");
  await expect(page.getByTestId("capacity-summary")).toContainText("доступно");

  const feasibilityResponse = await request.post(
    `${phase3ApiBaseUrl()}/api/crm/opportunities/opportunity-seed-ready/feasibility?testUser=resource-manager-a`,
    { data: {} }
  );
  await expect(feasibilityResponse).toBeOK();
  const feasibilityBody = (await feasibilityResponse.json()) as {
    demandEstimate: { totalPlannedWorkHours: number; stageRoleDemands: Array<{ roleKey: string }> };
    feasibility: { status: string; roleResults: Array<{ roleKey: string; availableHours: number }> };
  };
  expect(feasibilityBody.demandEstimate.totalPlannedWorkHours).toBeGreaterThan(0);
  expect(feasibilityBody.demandEstimate.stageRoleDemands.map((demand) => demand.roleKey)).toEqual(
    expect.arrayContaining(["project_manager", "solution_architect"])
  );
  expect(feasibilityBody.feasibility.status).toBe("fit");
  expect(feasibilityBody.feasibility.roleResults.every((roleResult) => roleResult.availableHours > 0)).toBe(true);
});
