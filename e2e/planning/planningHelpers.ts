import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("admin@kiss-pm.local");
  await page.getByLabel("Пароль", { exact: true }).fill("admin12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Дашборд" }).waitFor();
}

export async function openFirstProjectSchedule(page: Page) {
  const response = await page.request.get("/api/workspace/projects");
  if (!response.ok()) {
    throw new Error(`projects_list_failed:${response.status()}`);
  }

  const payload = (await response.json()) as { projects?: Array<{ id: string }> };
  const projectId = payload.projects?.[0]?.id;
  if (!projectId) {
    throw new Error("projects_list_empty");
  }

  await page.goto(`/projects/${encodeURIComponent(projectId)}/schedule`);
  await page.getByTestId("planning-workspace").waitFor();
}
