import { expect, test } from "@playwright/test";

import { applyImport, getIntegrationAudit, getMappings, openIntegrationAdmin, previewImport, tenantA as phase11Tenant } from "../phase11/helpers";
import { getDeploymentReadback, getOpsAudit, openKissPm, phase12Users, resetPhase12Fixtures, tenantA } from "./helpers";

test("E2E-115 release critical journey uses mocked external services and records readiness evidence", async ({
  page,
  request
}) => {
  await resetPhase12Fixtures(request);

  const deployment = await getDeploymentReadback(request);
  expect(deployment.status).toBe("passed");
  expect(deployment.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "external-services-mode", status: "passed", actual: "mocked" })
    ])
  );

  await openIntegrationAdmin(page, phase12Users.integrationAdmin);
  await expect(page.getByTestId("integration-adapter-list")).toContainText("Mock CRM");
  const preview = await previewImport(request, phase12Users.integrationAdmin);
  expect(preview.dryRunSummary).toMatchObject({ mutatesState: false, canApply: true });
  expect(await getMappings(request, phase12Users.integrationAdmin)).toEqual([]);

  const apply = await applyImport(
    request,
    preview.preview.id,
    tenantA.criticalJourney.integrationBatchId,
    "p12-e2e-115-mock-import",
    phase12Users.integrationAdmin
  );
  expect(apply.result.batch.id).toBe(tenantA.criticalJourney.integrationBatchId);
  expect((await getIntegrationAudit(request, phase12Users.integrationAdmin)).audit).toEqual(
    expect.arrayContaining([expect.objectContaining({ command: "import_apply", result: "success" })])
  );
  const mappingsAfterApply = await getMappings(request, phase12Users.integrationAdmin);
  expect(mappingsAfterApply.length).toBeGreaterThan(0);
  expect(mappingsAfterApply.every((mapping) => mapping.tenantId === phase11Tenant.tenantId)).toBe(true);

  await openKissPm(page, phase12Users.operatorAdmin);
  await expect(page.getByTestId("external-services-note")).toContainText("Внешние сервисы не используются");
  await page.getByRole("button", { name: "Запустить readiness" }).click();
  await expect(page.getByTestId("release-readiness-result")).toContainText("p12-readiness-tenant-a-0001");
  await expect(page.getByTestId("release-readiness-summary")).toContainText("p12-readiness-tenant-a-0001");
  await expect(page.getByTestId("release-readiness-summary")).not.toContainText("KISS_PM_EXTERNAL_SERVICES_MODE=mocked");
  expect((await getOpsAudit(request)).events).toEqual(
    expect.arrayContaining([expect.objectContaining({ actionKey: "ops.release_readiness.run" })])
  );

  await page.reload();
  await expect(page.getByTestId("release-readiness-summary")).toContainText("p12-readiness-tenant-a-0001");

  await resetPhase12Fixtures(request);
  expect(await getMappings(request, phase12Users.integrationAdmin)).toEqual([]);
});
