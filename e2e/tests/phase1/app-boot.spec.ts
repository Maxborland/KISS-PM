import { expect, test } from "@playwright/test";

test("E2E-001 application boots, health route responds, web shell renders", async ({ page, request }) => {
  const apiPort = process.env.PW_API_PORT ?? "4183";
  const health = await request.get(`http://127.0.0.1:${apiPort}/health`);
  await expect(health).toBeOK();
  expect(await health.json()).toEqual({ status: "ok", service: "kiss-pm-api" });

  await page.goto("/?testUser=project-manager-a");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "KISS PM" })).toBeVisible();
});
