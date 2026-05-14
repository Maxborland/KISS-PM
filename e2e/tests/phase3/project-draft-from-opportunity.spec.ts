import { expect, test } from "@playwright/test";

import {
  getOpportunityAudit,
  getProjectDraft,
  openCrmIntakeSurface,
  phase3ApiBaseUrl,
  resetPhase3Fixtures
} from "./helpers";

test("E2E-023 Project manager creates a governed project draft from a qualified opportunity", async ({
  page,
  request
}) => {
  await resetPhase3Fixtures(request);
  await openCrmIntakeSurface(page, "project-manager-a");

  await page.getByRole("button", { name: "Проверить готовность" }).click();
  await expect(page.getByTestId("readiness-next-action")).toContainText("Запустить оценку реализуемости");
  await page.getByRole("button", { name: "Рассчитать реализуемость" }).click();
  await expect(page.getByTestId("feasibility-status")).toContainText("fit / warning");
  await page.getByRole("button", { name: "Создать проектный черновик" }).click();

  await expect(page.getByTestId("crm-intake-status")).toContainText("Проектный черновик создан");
  await expect(page.getByTestId("project-draft-result")).toContainText("project-draft-opportunity-seed-ready");
  await expect(page.getByTestId("opportunity-audit-events")).toContainText("project_draft.create_from_opportunity");

  const projectBody = await getProjectDraft(request, "project-manager-a", "project-draft-opportunity-seed-ready");
  expect(projectBody.projectDraft).toEqual(
    expect.objectContaining({
      id: "project-draft-opportunity-seed-ready",
      tenantId: "tenant-a",
      status: "draft",
      sourceOpportunity: expect.objectContaining({
        type: "crm_opportunity",
        opportunityId: "opportunity-seed-ready"
      }),
      feasibility: expect.objectContaining({ status: "fit" })
    })
  );

  const auditBody = await getOpportunityAudit(request, "project-manager-a", "opportunity-seed-ready");
  expect(auditBody.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actorId: "project-manager-a",
        actionKey: "project_draft.create_from_opportunity",
        target: { entityType: "opportunity", entityId: "opportunity-seed-ready" },
        result: "success",
        correlationId: "corr-project-draft-opportunity-seed-ready",
        details: expect.objectContaining({
          after: expect.objectContaining({
            projectDraftId: "project-draft-opportunity-seed-ready",
            processTemplate: expect.objectContaining({
              assumptions: expect.arrayContaining([expect.objectContaining({ code: "integration_delivery" })])
            })
          })
        })
      })
    ])
  );

  const deniedResponse = await request.post(
    `${phase3ApiBaseUrl()}/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=readonly-observer-a`,
    { data: {} }
  );
  expect(deniedResponse.status()).toBe(403);
  await expect(deniedResponse.json()).resolves.toEqual(expect.objectContaining({ code: "permission_denied" }));

  await page.reload();
  await expect(page.getByTestId("crm-intake-surface")).toBeVisible();
  await expect(page.getByTestId("project-draft-result")).toContainText("project-draft-opportunity-seed-ready");
});
