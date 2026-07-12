import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

// Живые поверхности оболочки: /dashboard (dashboard-surface) и /projects
// (projects-list-surface); обе рендерят <main> с заголовком h1.
test.describe("Workspace shell accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, { password: "admin12345" });
  });

  test("dashboard has no critical axe violations", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });

  test("projects list has no critical axe violations", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
});
