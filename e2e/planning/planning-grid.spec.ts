import { expect, test } from "@playwright/test";

import { loginAsAdmin, openFirstProjectSchedule } from "./planningHelpers";

test.describe("Planning grid Phase B", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens schedule workspace with WBS and Gantt panes", async ({ page }) => {
    await openFirstProjectSchedule(page);
    await expect(page.getByTestId("planning-wbs-grid")).toBeVisible();
    await expect(page.getByTestId("planning-gantt-pane")).toBeVisible();
  });

  test("shows conflict banner after remote plan version bump", async ({ page, request }) => {
    await openFirstProjectSchedule(page);
    const projectId = page.url().match(/\/projects\/([^/]+)\/schedule/)?.[1];
    expect(projectId).toBeTruthy();

    const bump = await request.post(
      `http://127.0.0.1:${process.env.E2E_API_PORT ?? "4100"}/api/workspace/projects/${projectId}/planning/test/bump-plan-version`,
      {
        headers: { cookie: await page.context().cookies().then((cookies) =>
          cookies.map((c) => `${c.name}=${c.value}`).join("; ")
        ) }
      }
    );
    test.skip(bump.status() === 404, "test hook disabled");

    await page.getByTestId("planning-wbs-grid").click();
    await page.keyboard.press("F2");
    await page.keyboard.type("Conflict task");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("planning-conflict-banner")).toBeVisible({ timeout: 15_000 });
  });
});
