import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project timeline renders live project tasks without demo fallback", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation/timeline");

  await expect(page.getByRole("heading", { name: /Гант · Школа на 600 мест/ })).toBeVisible();
  await expect(page.getByRole("grid", { name: /Диаграмма Ганта/ })).toBeVisible();
  await expect(page.getByLabel("Таблица WBS").getByText("Обмерить существующие классы")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Разработать концепцию");
  await expect(page.locator("body")).not.toContainText("mock");

  const screenshotPath = testInfo.outputPath("runtime-project-timeline.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);
});

test("project timeline task bars open project detail task context", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation/timeline");

  await page.locator('[data-gantt-row-id="task-beta-school-survey"]').click();

  await expect(page).toHaveURL(
    /\/projects\/project-beta-school-renovation\?taskId=task-beta-school-survey$/
  );
  await expect(page.getByRole("heading", { name: /Школа на 600 мест/ })).toBeVisible();
  await expect(page.getByLabel("Задача для активности")).toContainText(
    "Обмерить существующие классы"
  );
});

test("project timeline zoom switches between day week and month views", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation/timeline");

  const gantt = page.getByRole("grid", { name: /Диаграмма Ганта/ });
  await expect(gantt).toHaveAttribute("data-gantt-zoom", "day");
  await expect(page.getByLabel("Таблица WBS").getByText("Обмерить существующие классы")).toBeVisible();

  await page.getByText("Неделя", { exact: true }).click();
  await expect(gantt).toHaveAttribute("data-gantt-zoom", "week");

  await page.getByText("Месяц", { exact: true }).click();
  await expect(gantt).toHaveAttribute("data-gantt-zoom", "month");
  await expect(page.getByLabel("Таблица WBS").getByText("Обмерить существующие классы")).toBeVisible();

  const screenshotPath = testInfo.outputPath("runtime-project-timeline-zoom.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);
});

test("project timeline keeps critical task indicators on live overdue and waiting tasks", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation/timeline");

  const criticalSurvey = page.locator('[data-gantt-row-id="task-beta-school-survey"]').first();
  await expect(criticalSurvey).toHaveAttribute("data-gantt-critical", "true");
  await expect(criticalSurvey).toHaveClass(/gbar--critical/);

  const criticalFireBrief = page.locator('[data-gantt-row-id="task-beta-school-fire-brief"]').first();
  await expect(criticalFireBrief).toHaveAttribute("data-gantt-critical", "true");
  await expect(criticalFireBrief).toHaveClass(/gbar--critical/);
});
