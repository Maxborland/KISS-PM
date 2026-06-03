import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("founder-beta management walkthrough reaches the first unresolved beta blocker @founder-beta-walkthrough", async ({
  page
}, testInfo) => {
  test.fail(
    true,
    "Current blocker: dashboard attention rows are static. Founder-beta walkthrough needs dashboard signal -> real task/project/deal navigation before task/Gantt/My Work/agent/audit can be verified end-to-end."
  );

  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await test.step("dashboard opens with live operational cockpit data", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("Живая сводка по проектам")).toBeVisible();
    await expect(page.getByText("Что требует внимания")).toBeVisible();
    await expect(page.getByText("Ресурсные риски")).toBeVisible();
    await expect(page.getByText("Управленческий агент")).toBeVisible();
  });

  await test.step("attention cockpit must link the user into the affected entity", async () => {
    const attentionRow = page.getByRole("row", { name: /Обмерить существующие классы/ });
    await expect(attentionRow).toBeVisible();

    const screenshotPath = testInfo.outputPath("founder-beta-walkthrough-first-blocker-dashboard.png");
    await page.screenshot({ fullPage: true, path: screenshotPath });
    expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

    await expect(attentionRow.getByRole("link").first()).toBeVisible();
  });

  await test.step("planned continuation after the blocker is fixed", async () => {
    await page.goto("/projects/project-beta-school-renovation");
    await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();

    await page.goto("/projects/project-beta-school-renovation/timeline");
    await expect(page.getByRole("grid", { name: /Диаграмма Ганта/ })).toBeVisible();

    await page.goto("/my-work");
    await expect(page.getByText("Моя работа")).toBeVisible();

    await page.goto("/agent");
    await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
  });
});
