import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./planningHelpers";

test("assignments matrix inline edit triggers preview bar", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/projects");
  await page.getByRole("link", { name: /проект/i }).first().click();
  const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
  await page.goto(`/projects/${projectId}/assignments`);
  const input = page.getByTestId("planning-assignments-pane").locator("input").first();
  test.skip((await input.count()) === 0, "no assignments in seed");
  await input.fill("800");
  await input.blur();
  await expect(page.getByTestId("planning-apply-bar")).toBeVisible({ timeout: 15_000 });
});
