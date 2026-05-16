import { expect, test } from "@playwright/test";

import {
  getConfigurationOverview,
  openConfigurationOverview,
  phase10ApiBaseUrl,
  resetPhase10Fixtures,
  tenantA
} from "./helpers";

test("E2E-094 invalid configuration is rejected with actionable validation and no partial mutation", async ({
  page,
  request
}) => {
  await resetPhase10Fixtures(request);
  await openConfigurationOverview(page);

  const before = await getConfigurationOverview(request);
  await page.getByTestId("configuration-overview-surface").getByRole("button", { name: "Экспорт" }).click();
  await expect(page.getByTestId("configuration-overview-status")).toContainText("Пакет экспортирован из API");
  const packageInput = page.getByLabel("JSON пакета импорта");
  const exportedText = await packageInput.inputValue();
  const tamperedPackage = { ...JSON.parse(exportedText), checksum: "bad-checksum" };
  await packageInput.fill(JSON.stringify(tamperedPackage, null, 2));

  await page.getByTestId("configuration-overview-surface").getByRole("button", { name: "Предпросмотр импорта" }).click();
  await expect(page.getByTestId("configuration-overview-status")).toContainText("Пакет содержит ошибки валидации");
  await expect(page.getByTestId("configuration-import-preview")).toContainText("import_checksum_mismatch");
  await expect(page.getByRole("button", { name: "Применить импорт" })).toBeDisabled();
  expect(await getConfigurationOverview(request)).toEqual(before);

  const readOnlyExport = await request.get(
    `${phase10ApiBaseUrl()}/api/tenant/configuration/export?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`
  );
  expect(readOnlyExport.status()).toBe(403);

  await page.reload();
  await expect(page.getByTestId("configuration-overview-readback")).toContainText(`v${before.active.configurationVersion}`);

  await resetPhase10Fixtures(request);
  expect((await getConfigurationOverview(request)).active.configurationVersion).toBe(1);
});
