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

test("workspace agent shows forbidden state and writes denied audit without project read access @agent-forbidden", async ({
  page
}, testInfo) => {
  await login(page, adminCredentials);

  try {
    await setProjectTeamPermissions(page, projectTeamRole.basePermissions);

    await login(page, architectCredentials);
    await expectCurrentPermissions(page, ["tenant.projects.read"]);
    await page.goto("/agent");
    await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();

    await login(page, adminCredentials);
    await setProjectTeamPermissions(
      page,
      projectTeamRole.basePermissions.filter((permission) => permission !== "tenant.projects.read")
    );

    await login(page, architectCredentials);
    await expectCurrentPermissions(page, [], ["tenant.projects.read"]);

    const deniedThread = await page.request.get("/api/workspace/agent-thread");
    expect(deniedThread.status()).toBe(403);
    await expect(deniedThread.json()).resolves.toEqual({ error: "permission_missing" });

    await page.goto("/agent");
    await expect(page.getByRole("alert").filter({ hasText: "Нет доступа" })).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "Недостаточно прав для просмотра этого раздела рабочей области."
    );
    await expect(page.locator("body")).not.toContainText("Сообщение Генри Гантту");

    const screenshotPath = testInfo.outputPath("runtime-agent-forbidden-project-read.png");
    await page.screenshot({ fullPage: true, path: screenshotPath });
    expect(statSync(screenshotPath).size).toBeGreaterThan(4_000);

    await login(page, adminCredentials);
    await page.goto("/admin/audit");
    const deniedAuditItem = page.locator(".audit-list__item").filter({
      hasText: "workspace.agent_thread.read_denied"
    });
    await expect(deniedAuditItem.first()).toContainText("WorkspaceAgentThread:portfolio");
    await expect(deniedAuditItem.first()).toContainText("отклонено");
  } finally {
    await login(page, adminCredentials);
    await setProjectTeamPermissions(page, projectTeamRole.basePermissions);
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

async function setProjectTeamPermissions(page: Page, permissions: string[]) {
  const response = await page.request.patch(`/api/workspace/access-roles/${projectTeamRole.id}`, {
    headers: { "x-kiss-pm-action": "same-origin" },
    data: {
      name: projectTeamRole.name,
      permissions
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
