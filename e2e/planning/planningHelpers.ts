import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("admin@kiss-pm.local");
  await page.getByLabel("Пароль").fill("local-admin-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/dashboard");
}

export async function openFirstProjectSchedule(page: Page) {
  await page.goto("/projects");
  await page.getByRole("link", { name: /проект/i }).first().click();
  await page.getByRole("link", { name: "График" }).click();
  await page.waitForURL("**/schedule");
  await page.getByTestId("planning-workspace").waitFor();
}
