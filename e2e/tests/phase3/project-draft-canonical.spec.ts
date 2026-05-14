import { expect, test } from "@playwright/test";

import { getProjectDraft, openCrmIntakeSurface, phase3ApiBaseUrl, resetPhase3Fixtures } from "./helpers";

test("E2E-024 Created project draft remains canonical without external CRM adapter state", async ({
  page,
  request
}) => {
  await resetPhase3Fixtures(request);
  await openCrmIntakeSurface(page, "project-manager-a");

  await page.getByRole("button", { name: "Создать проектный черновик" }).click();
  await expect(page.getByTestId("project-draft-result")).toContainText("project-draft-opportunity-seed-ready");

  const projectBody = await getProjectDraft(request, "project-manager-a", "project-draft-opportunity-seed-ready");
  expect(projectBody.projectDraft.sourceOpportunity).toEqual(
    expect.objectContaining({
      type: "crm_opportunity",
      opportunityId: "opportunity-seed-ready",
      title: "Внедрение портала АКМЕ"
    })
  );
  expect(projectBody.projectDraft.processTemplate.key).toBe("implementation.integration_heavy");
  expect(projectBody.projectDraft.processTemplate.assumptions).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: "integration_delivery" })])
  );
  expect(projectBody.projectDraft.demand.totalPlannedWorkHours).toBeGreaterThan(0);
  expect(projectBody.projectDraft.correlationId).toBe("corr-project-draft-opportunity-seed-ready");

  const foreignOpportunityResponse = await request.get(
    `${phase3ApiBaseUrl()}/api/crm/opportunities/opportunity-b-private?testUser=project-manager-a`
  );
  expect(foreignOpportunityResponse.status()).toBe(404);
  const foreignOpportunityBody = await foreignOpportunityResponse.text();
  expect(foreignOpportunityBody).toContain("not_found");
  expect(foreignOpportunityBody).not.toContain("Tenant B private opportunity");
  expect(foreignOpportunityBody).not.toContain("opportunity-b-private");

  const foreignProjectResponse = await request.get(
    `${phase3ApiBaseUrl()}/api/projects/project-draft-opportunity-b-private?testUser=project-manager-a`
  );
  expect(foreignProjectResponse.status()).toBe(404);
  const foreignProjectBody = await foreignProjectResponse.text();
  expect(foreignProjectBody).toContain("not_found");
  expect(foreignProjectBody).not.toContain("Tenant B");

  await page.reload();
  await expect(page.getByTestId("crm-intake-surface")).toBeVisible();
  await expect(page.getByTestId("project-draft-result")).toContainText("project-draft-opportunity-seed-ready");
});
