import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("authenticated runtime root renders dashboard without runtime errors", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/");
  await page.waitForURL("**/dashboard");

  await expect(page).toHaveTitle(/KISS PM/);
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Камил" })).toBeVisible();
  await expect(page.getByText("Runtime-сводка по проектам и вашей работе")).toBeVisible();

  const desktopScreenshotPath = testInfo.outputPath("runtime-foundation-desktop.png");
  await page.screenshot({ fullPage: true, path: desktopScreenshotPath });
  expect(statSync(desktopScreenshotPath).size).toBeGreaterThan(10_000);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Камил" })).toBeVisible();
  const narrowScreenshotPath = testInfo.outputPath("runtime-foundation-narrow.png");
  await page.screenshot({ fullPage: true, path: narrowScreenshotPath });
  expect(statSync(narrowScreenshotPath).size).toBeGreaterThan(5_000);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("authenticated beta runtime routes open without blank or error states", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  for (const route of [
    { path: "/dashboard", marker: "Runtime-сводка по проектам" },
    { path: "/my-work", marker: "Моя работа" },
    { path: "/agent", marker: "Генри Гантт" },
    { path: "/projects", marker: "Проекты" },
    { path: "/deals", marker: "Сделки" }
  ] as const) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route.path);
    await expect(page).toHaveURL(new RegExp(`${route.path.replace("/", "\\/")}$`));
    await expect(page.locator("body")).toContainText(route.marker);
    await expect(page.locator("body")).not.toContainText("Не удалось");
    await expect(page.locator("body")).not.toContainText("Нет доступа");

    const desktopScreenshotPath = testInfo.outputPath(
      `runtime-${route.path.slice(1).replaceAll("/", "-")}-desktop.png`
    );
    await page.screenshot({ fullPage: true, path: desktopScreenshotPath });
    expect(statSync(desktopScreenshotPath).size).toBeGreaterThan(8_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("body")).toContainText(route.marker);
    if (route.path === "/dashboard") {
      await expect(page.getByRole("link", { name: "Агент" })).toBeVisible();
    }
    if (route.path === "/agent") {
      await expect(page.getByLabel("Единый управленческий агент")).toBeVisible();
      await expect(page.getByText("Сверка изменений")).toBeVisible();
    }
    if (route.path === "/projects") {
      await expect(page.getByRole("link", { name: "Гант" })).toBeVisible();
    }
    const narrowScreenshotPath = testInfo.outputPath(
      `runtime-${route.path.slice(1).replaceAll("/", "-")}-narrow.png`
    );
    await page.screenshot({ fullPage: true, path: narrowScreenshotPath });
    expect(statSync(narrowScreenshotPath).size).toBeGreaterThan(4_000);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasHorizontalOverflow, route.path).toBe(false);
  }
});
