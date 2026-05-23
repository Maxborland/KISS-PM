import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./planningHelpers";

test("resources pane opens from project tab", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/projects");
  await page.getByRole("link", { name: /проект/i }).first().click();
  const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
  await page.goto(`/projects/${projectId}/resources`);
  await expect(page.getByTestId("planning-resources-pane")).toBeVisible();
});
