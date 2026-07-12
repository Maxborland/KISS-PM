import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

// Живые роуты: /settings (settings-surface) и /profile (profile-surface);
// оба рендерят форму профиля с заголовком «Редактирование профиля».
test.describe("Settings accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, { password: "admin12345" });
  });

  test("workspace settings has no critical axe violations", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Редактирование профиля" })).toBeVisible();
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });

  test("profile page has no critical axe violations", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Редактирование профиля" })).toBeVisible();
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
});
