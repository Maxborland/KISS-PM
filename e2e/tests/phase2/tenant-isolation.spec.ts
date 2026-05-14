import { expect, test } from "@playwright/test";

import { openPhase2Surface, phase2ApiBaseUrl, resetPhase2Fixtures } from "./helpers";

test("E2E-010 Tenant A user cannot see Tenant B probe data through UI or direct API", async ({ page, request }) => {
  await resetPhase2Fixtures(request);
  await openPhase2Surface(page, "project-manager-a");

  await page.getByRole("button", { name: "Показать свою пробу" }).click();
  await expect(page.getByTestId("probe-result")).toContainText("tenant-a");
  await expect(page.getByTestId("probe-result")).toContainText("Закрытые данные Tenant A");

  await page.getByRole("button", { name: "Проверить чужую пробу" }).click();
  await expect(page.getByTestId("probe-result")).toContainText("Объект не найден");
  await expect(page.getByTestId("permission-diagnostics")).toContainText("tenant_mismatch");
  await expect(page.getByText("Закрытые данные Tenant B")).toHaveCount(0);
  await expect(page.getByText("probe-b-private")).toHaveCount(0);

  const directResponse = await request.get(`${phase2ApiBaseUrl()}/tenant-isolation-probes/probe-b-private?testUser=project-manager-a`);
  expect(directResponse.status()).toBe(404);
  const directBody = await directResponse.text();
  expect(directBody).toContain("not_found");
  expect(directBody).not.toContain("Закрытые данные Tenant B");
  expect(directBody).not.toContain("probe-b-private");

  await page.reload();
  await expect(page.getByTestId("phase2-admin-surface")).toBeVisible();
  await page.getByRole("button", { name: "Проверить чужую пробу" }).click();
  await expect(page.getByTestId("probe-result")).toContainText("Объект не найден");
});

test("E2E-010 Tenant B user receives Tenant B own probe and safe Tenant A denial", async ({ page, request }) => {
  await resetPhase2Fixtures(request);
  await openPhase2Surface(page, "tenant-admin-b");

  await page.getByRole("button", { name: "Показать свою пробу" }).click();
  await expect(page.getByTestId("probe-result")).toContainText("tenant-b");
  await expect(page.getByTestId("probe-result")).toContainText("Закрытые данные Tenant B");

  await page.getByRole("button", { name: "Проверить чужую пробу" }).click();
  await expect(page.getByTestId("probe-result")).toContainText("Объект не найден");
  await expect(page.getByTestId("permission-diagnostics")).toContainText("tenant_mismatch");
  await expect(page.getByText("Закрытые данные Tenant A")).toHaveCount(0);
  await expect(page.getByText("probe-a-private")).toHaveCount(0);
});
