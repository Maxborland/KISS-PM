import { statSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("unknown project detail route shows not-found without fixture fallback @project-detail-not-found", async ({
  page
}, testInfo) => {
  const issues = collectUnexpectedIssues(page);
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-missing");

  await expect(page.getByRole("heading", { name: "Проект не найден" })).toBeVisible();
  await expect(page.getByText("Проверьте ссылку или вернитесь к списку проектов.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Школа на 600 мест — реконструкция");
  await expect(page.locator("body")).not.toContainText("DataHub KPI");

  const screenshotPath = testInfo.outputPath("runtime-project-detail-not-found.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);
  expect(issues).toEqual([]);
});

function collectUnexpectedIssues(page: Page) {
  const issues: string[] = [];

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (isExpectedMissingProject404(message.text(), message.location().url)) return;
    issues.push(`console.error: ${message.text()}`);
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (response.status() === 404 && /\/api\/workspace\/projects\/project-beta-missing$/.test(url)) return;
    if (response.status() === 404 && /\/favicon\.ico(?:\?|$)/.test(url)) return;
    issues.push(`${response.status()} ${response.request().method()} ${url}`);
  });

  return issues;
}

function isExpectedMissingProject404(text: string, url: string): boolean {
  return (
    /\/api\/workspace\/projects\/project-beta-missing$/.test(url) &&
    /Failed to load resource|404|not found/i.test(text)
  );
}
