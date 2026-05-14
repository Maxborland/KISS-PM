import { expect, test } from "@playwright/test";

import { getAuditEvents, openPhase2Surface, phase2ApiBaseUrl, resetPhase2Fixtures } from "./helpers";

test("E2E-013 Tenant label change is reflected in UI without code changes and remains traceable", async ({
  page,
  request
}) => {
  await resetPhase2Fixtures(request);
  const currentBeforeResponse = await request.get(`${phase2ApiBaseUrl()}/tenants/current?testUser=tenant-admin-a`);
  await expect(currentBeforeResponse).toBeOK();
  const currentBeforeBody = (await currentBeforeResponse.json()) as {
    labels: Record<string, string>;
    tenant: { configurationVersion: number };
  };
  const beforeLabel = currentBeforeBody.labels["navigation.admin"];
  const beforeVersion = currentBeforeBody.tenant.configurationVersion;
  const afterVersion = beforeVersion + 1;

  await openPhase2Surface(page, "tenant-admin-a");

  await expect(page.getByTestId("admin-navigation-label")).toContainText(beforeLabel);
  await page.getByLabel("Метка раздела администрирования").fill("Настройки доступа");
  await page.getByRole("button", { name: "Сохранить метку" }).click();

  await expect(page.getByTestId("phase2-status")).toContainText("Метка сохранена");
  await expect(page.getByTestId("admin-navigation-label")).toContainText("Настройки доступа");
  await expect(page.getByTestId("tenant-configuration-version")).toContainText(`Версия конфигурации: ${afterVersion}`);
  await expect(page.getByTestId("audit-events")).toContainText("tenant_label.update");
  await expect(page.getByTestId("audit-events")).toContainText("navigation.admin");

  await page.reload();
  await expect(page.getByTestId("phase2-admin-surface")).toBeVisible();
  await expect(page.getByTestId("admin-navigation-label")).toContainText("Настройки доступа");

  const currentResponse = await request.get(`${phase2ApiBaseUrl()}/tenants/current?testUser=tenant-admin-a`);
  await expect(currentResponse).toBeOK();
  const currentBody = (await currentResponse.json()) as {
    labels: Record<string, string>;
    tenant: { configurationVersion: number };
  };
  expect(currentBody.labels["navigation.admin"]).toBe("Настройки доступа");
  expect(currentBody.tenant.configurationVersion).toBe(afterVersion);

  const auditBody = await getAuditEvents(request, "tenant-admin-a");
  expect(auditBody.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actionKey: "tenant_label.update",
        target: { entityType: "tenantLabel", entityId: "navigation.admin" },
        details: expect.objectContaining({
          previousConfigurationVersion: beforeVersion,
          newConfigurationVersion: afterVersion,
          changedLabel: {
            key: "navigation.admin",
            beforeLabel,
            afterLabel: "Настройки доступа"
          }
        })
      })
    ])
  );
});
