import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

// Живой CRM-роут — /crm/deals (deals-surface.tsx внутри CrmFrame).
// Кнопка создания сделки: видимый текст «Сделка», title «Создать сделку»
// (accessible name считается по тексту, поэтому локатор — по «Сделка»).
test.describe("CRM accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, { password: "admin12345" });
  });

  test("deals surface has no critical axe violations", async ({ page }) => {
    await page.goto("/crm/deals");
    await expect(page.getByRole("heading", { name: "Продажи и клиенты" })).toBeVisible();
    // Кнопка действий рендерится только в загруженном состоянии CrmFrame.
    await expect(page.getByRole("button", { name: "Сделка", exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });

  test("deal create dialog has no critical axe violations", async ({ page }) => {
    await page.goto("/crm/deals");
    await expect(page.getByRole("heading", { name: "Продажи и клиенты" })).toBeVisible();
    await page.getByRole("button", { name: "Сделка", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
});
