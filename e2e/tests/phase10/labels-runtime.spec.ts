import { expect, test } from "@playwright/test";

import {
  getConfigurationAudit,
  createManagedProject,
  createOpportunity,
  getProcessTemplates,
  getProject,
  getTenantLabels,
  jsonRequest,
  openTenantLabels,
  phase10ApiBaseUrl,
  resetPhase10Fixtures,
  tenantA,
  tenantB
} from "./helpers";

test("E2E-090 admin renames roles/stages and sees runtime labels with audit, reload, denial, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase10Fixtures(request);
  const stableProjectId = await createManagedProject(request, "project-p10-existing-template-stable");
  const stableProjectBefore = await getProject(request, stableProjectId);
  const tenantAPreview = await request.post(
    `${phase10ApiBaseUrl()}/api/tenant/labels/preview?testUser=${encodeURIComponent(tenantA.adminUserId)}`,
    jsonRequest({
      changes: [{ key: "runtime.role.project_manager", label: "tenant-a-private-preview" }],
      affectedRuntimeSurfaces: ["task.participant.role"]
    })
  );
  await expect(tenantAPreview).toBeOK();
  const tenantAPreviewBody = (await tenantAPreview.json()) as { preview: { id: string } };

  await openTenantLabels(page);

  await expect(page.getByTestId("tenant-labels-runtime-projection")).toContainText("Руководитель проекта");
  const labelsSurface = page.getByTestId("tenant-labels-admin");
  await labelsSurface.getByLabel("Роль руководителя проекта").fill(tenantA.labelChanges.roleProjectManager);
  await labelsSurface.getByLabel("Начальная стадия", { exact: true }).fill(tenantA.labelChanges.stageInitiation);
  await labelsSurface.getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("tenant-labels-preview")).toContainText("Состояние еще не изменено");
  expect((await getTenantLabels(request)).labelSet.configurationVersion).toBe(1);

  const readOnlyPreview = await request.post(
    `${phase10ApiBaseUrl()}/api/tenant/labels/preview?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`,
    jsonRequest({
      changes: [{ key: "runtime.role.project_manager", label: "readonly attempt" }],
      affectedRuntimeSurfaces: ["task.participant.role"]
    })
  );
  expect(readOnlyPreview.status()).toBe(403);

  const tenantBPublish = await request.post(
    `${phase10ApiBaseUrl()}/api/tenant/labels/publish?testUser=${encodeURIComponent(tenantB.adminUserId)}`,
    jsonRequest({ previewId: tenantAPreviewBody.preview.id })
  );
  expect([404, 409]).toContain(tenantBPublish.status());
  expect(await tenantBPublish.text()).not.toContain(tenantA.adminUserId);

  await labelsSurface.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByTestId("tenant-labels-result")).toContainText("tenant_label_set.publish");
  await expect(page.getByTestId("tenant-labels-audit")).toContainText("tenant_label_set.publish");
  await expect(page.getByTestId("tenant-labels-runtime-projection")).toContainText(tenantA.labelChanges.roleProjectManager);
  await expect(page.getByTestId("tenant-labels-runtime-projection")).toContainText(tenantA.labelChanges.stageInitiation);

  const readback = await getTenantLabels(request);
  expect(readback.labelSet.configurationVersion).toBe(2);
  expect(readback.runtimeProjection.roles).toEqual(
    expect.arrayContaining([{ key: "project_manager", label: tenantA.labelChanges.roleProjectManager }])
  );
  expect(readback.runtimeProjection.stages).toEqual(
    expect.arrayContaining([{ key: "initiation", label: tenantA.labelChanges.stageInitiation }])
  );
  expect((await getConfigurationAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "tenant_label_set.publish" })])
  );

  await page.reload();
  await expect(page.getByTestId("tenant-labels-runtime-projection")).toContainText(tenantA.labelChanges.roleProjectManager);

  const processSurface = page.getByTestId("process-template-builder");
  await expect(page.getByTestId("process-template-status")).toContainText("Шаблоны загружены из API");
  await expect(processSurface.getByTestId("process-template-stage-list")).toContainText("Исполнение");
  await processSurface.getByLabel("Название шаблона").fill("Внедрение enterprise E2E");
  await processSurface.getByLabel("Стадия поставки").fill("Поставка P10 E2E");
  await processSurface.getByLabel("Задача поставки").fill("Поставка результата P10");
  await processSurface.getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("process-template-preview")).toContainText("Состояние еще не изменено");
  expect((await getProcessTemplates(request)).templates[0]!.version).toBe(2);

  await processSurface.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByTestId("process-template-result")).toContainText("process_template.publish");
  const processReadback = await getProcessTemplates(request);
  expect(processReadback.templates[0]).toMatchObject({
    version: 3,
    label: "Внедрение enterprise E2E"
  });
  expect(await getProject(request, stableProjectId)).toMatchObject(stableProjectBefore);

  const futureOpportunityId = await createOpportunity(request, "opportunity-p10-future-template-e2e");
  const futureProjectId = await createManagedProject(request, "project-p10-future-template-e2e", futureOpportunityId);
  const futureProject = await getProject(request, futureProjectId);
  expect(futureProject.project.processTemplateSnapshot).toMatchObject({
    version: 3,
    label: "Внедрение enterprise E2E"
  });
  expect(futureProject.project.stages).toEqual(
    expect.arrayContaining([expect.objectContaining({ templateKey: "delivery", label: "Поставка P10 E2E" })])
  );
  expect((await getConfigurationAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "process_template.publish" })])
  );

  await resetPhase10Fixtures(request);
  const restored = await getTenantLabels(request);
  expect(restored.labelSet.configurationVersion).toBe(1);
  expect(restored.labelSet.labels["runtime.role.project_manager"]).toBe("Руководитель проекта");
  expect((await getProcessTemplates(request)).templates[0]!.version).toBe(2);
});
