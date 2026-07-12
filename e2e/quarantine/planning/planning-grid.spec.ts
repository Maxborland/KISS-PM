import { expect, test } from "@playwright/test";

import { loginAsAdmin, openFirstProjectSchedule } from "../../planning/planningHelpers";

test.describe("Planning grid Phase B", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens schedule workspace with WBS and Gantt panes", async ({ page }) => {
    await openFirstProjectSchedule(page);
    await expect(page.getByTestId("planning-schedule-pane")).toBeVisible();
    await expect(page.getByTestId("planning-wbs-grid")).toBeVisible();
    await expect(page.getByTestId("planning-gantt-pane")).toBeVisible();
  });

  test("gantt bar position responds to zoom scale", async ({ page }) => {
    await openFirstProjectSchedule(page);
    const bar = page.getByTestId("planning-gantt-bar").first();
    await expect(bar).toBeVisible();
    const leftDay = await bar.evaluate((element) => element.style.left);

    await page.getByLabel("Масштаб диаграммы").click();
    await page.getByRole("option", { name: "Неделя" }).click();

    const leftWeek = await bar.evaluate((element) => element.style.left);
    expect(leftDay).not.toBe(leftWeek);
    expect(leftWeek).not.toBe("0px");
  });

  test("renders dependency connectors when plan has links", async ({ page }) => {
    await openFirstProjectSchedule(page);
    const depLines = page.getByTestId("planning-gantt-dep-line");
    const count = await depLines.count();
    if (count === 0) {
      test.skip(true, "seed project has no FS dependencies to assert");
    }
    const firstPath = await depLines.first().getAttribute("d");
    expect(firstPath).toBeTruthy();
    expect(firstPath).not.toBe("M 20 18 L 80 18");
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
