import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

const targetUser = {
  id: "user-alpha-architect",
  name: "Сергей Архитектор"
};

test("admin can deactivate a workspace user and see status persist after reload", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  try {
    const reset = await page.request.patch(`/api/workspace/users/${targetUser.id}`, {
      headers: { "x-kiss-pm-action": "same-origin" },
      data: { status: "active" }
    });
    expect(reset.ok(), await reset.text()).toBe(true);

    await page.goto("/admin/users");
    const targetRow = page.getByRole("row").filter({ hasText: targetUser.name });
    await expect(targetRow).toContainText("Активен");
    await expect(targetRow.getByRole("button", { name: `Отключить пользователя ${targetUser.name}` })).toBeVisible();

    const statusPatch = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/workspace/users/${targetUser.id}`) &&
        response.request().method() === "PATCH" &&
        response.ok()
    );
    await targetRow.getByRole("button", { name: `Отключить пользователя ${targetUser.name}` }).click();
    await statusPatch;
    await expect(targetRow).toContainText("Отключён");

    await page.reload();
    const reloadedRow = page.getByRole("row").filter({ hasText: targetUser.name });
    await expect(reloadedRow).toContainText("Отключён");
    await expect(reloadedRow.getByRole("button", { name: `Включить пользователя ${targetUser.name}` })).toBeVisible();

    const screenshotPath = testInfo.outputPath("runtime-admin-user-deactivated.png");
    await reloadedRow.screenshot({ path: screenshotPath });
    expect(statSync(screenshotPath).size).toBeGreaterThan(4_000);
  } finally {
    await page.request.patch(`/api/workspace/users/${targetUser.id}`, {
      headers: { "x-kiss-pm-action": "same-origin" },
      data: { status: "active" }
    });
  }
});
