import { expect, test } from "@playwright/test";

import { openResourceLoadSurface, phase6Seed, resetPhase6Fixtures, tenantAOverloadId } from "./helpers";

test("E2E-052 overload resolution starts from the control surface and creates a dry-run preview", async ({
  page,
  request
}) => {
  await resetPhase6Fixtures(request);
  await openResourceLoadSurface(page);

  await expect(page.getByTestId("resource-overload-signal")).toContainText(tenantAOverloadId);
  await expect(page.getByRole("button", { name: "Предпросмотреть перенос" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Открыть Гантт проекта" })).toHaveCount(0);
  await page.getByRole("button", { name: "Предпросмотреть перенос" }).click();

  const preview = page.getByTestId("resource-resolution-preview");
  await expect(preview).toContainText("Preview до применения");
  await expect(preview).toContainText("Перенести работу");
  await expect(preview).toContainText("До: 50 ч");
  await expect(preview).toContainText("После: 8 ч");
  await expect(preview).toContainText("Состояние еще не изменено");
  await expect(page.getByTestId("resource-apply-result")).toHaveCount(0);
  await expect(page.getByTestId("resource-overload-signal")).toContainText(phase6Seed.tenantA.overload!.assignmentId);
});
