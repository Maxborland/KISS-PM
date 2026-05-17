import { expect, test } from "@playwright/test";

import { createManagedProject, resetPhase8Fixtures, tenantA } from "../phase8/helpers";

test("E2E-R2-010 Sales demo path: first 5 minutes surface clarity and no dead-end screen", async ({ page, request }) => {
  await resetPhase8Fixtures(request);
  await createManagedProject(request);
  await page.goto(`/?testUser=${encodeURIComponent(tenantA.adminUserId)}`);

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("operational-surface-shell").first()).toBeVisible();
  await expect(page.getByTestId("portfolio-control-surface")).toContainText("Портфельный контроль");
  await expect(page.getByTestId("portfolio-control-surface")).toContainText("Критично");
  await expect(page.getByRole("button", { name: "Создать корректирующую задачу" })).toBeVisible();

  await page.getByRole("button", { name: "Открыть Гантт" }).first().click();
  await expect(page.getByTestId("gantt-surface")).toContainText("Гантт");
  await expect(page.getByTestId("gantt-surface")).toContainText("Создать задачу в Гантте");
  await expect(page.getByTestId("gantt-surface")).toContainText("Зафиксировать базовый план");
  await expect(page.getByTestId("resource-load-surface")).toContainText("Предпросмотреть перенос");
  await expect(page.getByTestId("kpi-deviation-control")).toContainText("Оценка");
  await expect(page.getByTestId("kpi-deviation-control")).toContainText("eval-kpi-schedule-variance-a-1");
  await expect(page.getByTestId("saved-view-layout-builder-surface")).toContainText("Предпросмотр макета");
  await expect(page.getByTestId("configuration-overview-surface")).toContainText("Конфигурация");
});
