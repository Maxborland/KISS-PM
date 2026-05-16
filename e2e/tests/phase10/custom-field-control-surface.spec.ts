import { expect, test } from "@playwright/test";

import {
  createManagedProject,
  getConfigurationAudit,
  getCustomFields,
  getPortfolioView,
  getProject,
  jsonRequest,
  openCustomFields,
  phase10ApiBaseUrl,
  resetPhase10Fixtures,
  tenantA
} from "./helpers";

test("E2E-091 admin adds custom project field and uses it in a control surface with readback and cleanup", async ({
  page,
  request
}) => {
  await resetPhase10Fixtures(request);
  await createManagedProject(request);
  await openCustomFields(page);

  await expect(page.getByTestId("custom-field-registry")).toContainText("Нет опубликованных полей");
  await page.getByTestId("custom-field-builder-surface").getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("custom-field-preview")).toContainText("Состояние еще не изменено");
  expect((await getCustomFields(request)).registry.version).toBe(1);

  const readOnlyPreview = await request.post(
    `${phase10ApiBaseUrl()}/api/tenant/custom-fields/preview?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`,
    jsonRequest({
      expectedRegistryVersion: 1,
      draft: {
        id: `cf-project-${tenantA.customField.key}`,
        targetEntityType: "project",
        key: tenantA.customField.key,
        label: tenantA.customField.label,
        valueType: "single_select",
        required: false,
        active: true,
        validationRules: { options: tenantA.customField.options },
        visibilityRules: [{ surfaceKey: "portfolio.control", visible: true }],
        permissionRules: { readPermissionKey: "project.read", writePermissionKey: "custom_field.write" },
        bindingFlags: { usableInFilters: true, usableInControlSurfaces: true, usableInKpiSourceBindings: false }
      },
      affectedRuntimeSurfaces: ["portfolio.control"]
    })
  );
  expect(readOnlyPreview.status()).toBe(403);

  await page.getByTestId("custom-field-builder-surface").getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByTestId("custom-field-registry")).toContainText(`${tenantA.customField.label}: ${tenantA.customField.key}`);
  await expect(page.getByTestId("custom-field-result")).toContainText("custom_field.publish");

  await page.getByTestId("custom-field-builder-surface").getByRole("button", { name: "Записать значение" }).click();
  await expect(page.getByTestId("custom-field-surface-readback")).toContainText(`${tenantA.customField.value}`);
  await expect(page.getByTestId("custom-field-audit")).toContainText("project.custom_field.set");

  const readOnlyValueWrite = await request.put(
    `${phase10ApiBaseUrl()}/api/projects/${tenantA.customField.projectId}/custom-fields/${tenantA.customField.key}?testUser=${encodeURIComponent(
      tenantA.readOnlyUserId
    )}`,
    jsonRequest({ value: "low" })
  );
  expect(readOnlyValueWrite.status()).toBe(403);

  const project = await getProject(request, tenantA.customField.projectId);
  expect(project.project.customFieldValues).toEqual(
    expect.arrayContaining([expect.objectContaining({ fieldKey: tenantA.customField.key, value: tenantA.customField.value })])
  );
  expect((await getPortfolioView(request)).fields).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: `custom.${tenantA.customField.key}`, label: tenantA.customField.label })])
  );
  expect((await getConfigurationAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ commandType: "custom_field.publish" }),
      expect.objectContaining({ commandType: "project.custom_field.set" })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("custom-field-surface-readback")).toContainText(`${tenantA.customField.value}`);

  await resetPhase10Fixtures(request);
  expect((await getCustomFields(request)).registry.definitions).toEqual([]);
});
