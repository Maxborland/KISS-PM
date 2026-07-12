import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "../../planning/planningHelpers";

test("calendar exception dialog opens preview", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/projects");
  await page.getByRole("link", { name: /проект/i }).first().click();
  const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
  await page.goto(`/projects/${projectId}/calendars`);
  await page.getByRole("button", { name: "Добавить исключение" }).click();
  await page.locator('input[name="date"]').fill("2026-06-12");
  await page.getByRole("button", { name: "Превью" }).click();
  await expect(page.getByTestId("planning-apply-bar")).toBeVisible({ timeout: 15_000 });
});
