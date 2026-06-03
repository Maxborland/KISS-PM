import { statSync } from "node:fs";
import type { Page } from "@playwright/test";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

const architectCredentials = {
  email: "architect@kiss-pm.local",
  password: "architect12345"
};

const projectTeamRole = {
  id: "access-profile-alpha-project-team",
  name: "Проектная команда",
  basePermissions: [
    "tenant.projects.read",
    "tenant.workspace_config.read",
    "tenant.resource_feasibility.read",
    "profile.read",
    "profile.update"
  ]
};

test("admin role project access change affects runtime project access after relogin", async ({
  page
}, testInfo) => {
  await login(page, adminCredentials);

  try {
    await resetProjectTeamRole(page);

    await login(page, architectCredentials);
    await expectCurrentPermissions(page, ["tenant.projects.read"]);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Нет доступа");

    await login(page, adminCredentials);
    await page.goto("/admin/roles");
    const roleRow = page.getByRole("row").filter({ hasText: projectTeamRole.name });
    await expect(roleRow).toContainText("tenant.projects.read");

    const permissionPatch = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/workspace/access-roles/${projectTeamRole.id}`) &&
        response.request().method() === "PATCH" &&
        response.ok()
    );
    await roleRow
      .getByRole("button", { name: `Убрать доступ к проектам для роли ${projectTeamRole.name}` })
      .click();
    await permissionPatch;
    await expect(roleRow).not.toContainText("tenant.projects.read");

    const screenshotPath = testInfo.outputPath("runtime-admin-role-project-access-removed.png");
    await roleRow.screenshot({ path: screenshotPath });
    expect(statSync(screenshotPath).size).toBeGreaterThan(4_000);

    const auditFetch = page.waitForResponse(
      (response) =>
        response.url().includes("/api/tenant/current/audit-events") &&
        response.request().method() === "GET" &&
        response.ok()
    );
    await page.goto("/admin/audit");
    await auditFetch;
    const auditItem = page.locator(".audit-list__item").filter({
      hasText: "AccessProfile:access-profile-alpha-project-team"
    });
    await expect(auditItem.first()).toContainText("tenant.access_profile.updated");
    await expect(auditItem.first()).toContainText("single_workspace_access_roles");
    await expect(auditItem.first()).toContainText("user-alpha-admin");
    await expect(auditItem.first()).toContainText("разрешено");
    await expect(auditItem.first()).toContainText("выполнено");

    await login(page, architectCredentials);
    await expectCurrentPermissions(page, [], ["tenant.projects.read"]);
    await page.goto("/projects");
    const forbiddenState = page.getByRole("alert").filter({ hasText: "Нет доступа" });
    await expect(forbiddenState).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "Недостаточно прав для просмотра этого раздела рабочей области."
    );
  } finally {
    await login(page, adminCredentials);
    await resetProjectTeamRole(page);
  }
});

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Эл. почта").fill(credentials.email);
  await page.getByLabel("Пароль").fill(credentials.password);

  const loginRequest = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") &&
      response.request().method() === "POST" &&
      response.ok()
  );
  await page.getByRole("button", { name: "Войти" }).click();
  await loginRequest;
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function resetProjectTeamRole(page: Page) {
  const response = await page.request.patch(`/api/workspace/access-roles/${projectTeamRole.id}`, {
    headers: { "x-kiss-pm-action": "same-origin" },
    data: {
      name: projectTeamRole.name,
      permissions: projectTeamRole.basePermissions
    }
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function expectCurrentPermissions(
  page: Page,
  included: string[],
  excluded: string[] = []
) {
  const response = await page.request.get("/api/auth/me");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as { permissions?: string[] };
  for (const permission of included) {
    expect(body.permissions ?? []).toContain(permission);
  }
  for (const permission of excluded) {
    expect(body.permissions ?? []).not.toContain(permission);
  }
}
