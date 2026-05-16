import { createConfigurationImportPackageWithChecksum } from "@kiss-pm/tenant-config";
import { expect, test } from "@playwright/test";

import {
  createManagedProject,
  getConfigurationAudit,
  getConfigurationOverview,
  getProject,
  jsonRequest,
  openConfigurationOverview,
  phase10ApiBaseUrl,
  resetPhase10Fixtures,
  tenantA
} from "./helpers";

test("E2E-095 runtime remains stable after unrelated configuration import with audit, reload, denial, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase10Fixtures(request);
  const projectId = await createManagedProject(request, "project-p10-regression-stable");
  const projectBefore = await getProject(request, projectId);
  await openConfigurationOverview(page);

  const exported = await request.get(
    `${phase10ApiBaseUrl()}/api/tenant/configuration/export?testUser=${encodeURIComponent(tenantA.adminUserId)}`
  );
  await expect(exported).toBeOK();
  const exportedBody = (await exported.json()) as { package: Parameters<typeof createConfigurationImportPackageWithChecksum>[0] };
  const incoming = createConfigurationImportPackageWithChecksum({
    ...exportedBody.package,
    configurationVersion: 2,
    exportedAt: "2026-08-01T01:10:00.000Z",
    labelSet: {
      ...exportedBody.package.labelSet,
      configurationVersion: 2,
      labels: {
        ...exportedBody.package.labelSet.labels,
        "runtime.role.project_manager": tenantA.importedRoleLabel
      },
      updatedAt: "2026-08-01T01:10:00.000Z"
    }
  });

  const readOnlyPreview = await request.post(
    `${phase10ApiBaseUrl()}/api/tenant/configuration/import/preview?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`,
    jsonRequest({ package: incoming })
  );
  expect(readOnlyPreview.status()).toBe(403);

  await page.getByLabel("JSON пакета импорта").fill(JSON.stringify(incoming, null, 2));
  await page.getByTestId("configuration-overview-surface").getByRole("button", { name: "Предпросмотр импорта" }).click();
  await expect(page.getByTestId("configuration-import-preview")).toContainText("Состояние еще не изменено");
  expect(await getProject(request, projectId)).toMatchObject(projectBefore);

  await page.getByTestId("configuration-overview-surface").getByRole("button", { name: "Применить импорт" }).click();
  await expect(page.getByTestId("configuration-import-result")).toContainText("tenant_configuration.import_apply");
  await expect(page.getByTestId("configuration-overview-audit")).toContainText("tenant_configuration.import_apply");
  expect((await getConfigurationOverview(request)).active.configurationVersion).toBe(2);
  expect(await getProject(request, projectId)).toMatchObject(projectBefore);
  expect((await getConfigurationAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "tenant_configuration.import_apply" })])
  );

  await page.reload();
  await expect(page.getByTestId("configuration-overview-readback")).toContainText("v2");
  expect(await getProject(request, projectId)).toMatchObject(projectBefore);

  await resetPhase10Fixtures(request);
  expect((await getConfigurationOverview(request)).active.configurationVersion).toBe(1);
});
