import { expect, test } from "@playwright/test";

import { listOpportunities, openCrmIntakeSurface, resetPhase3Fixtures } from "./helpers";

test("E2E-020 User creates an opportunity with required fields through CRM Intake Control", async ({
  page,
  request
}) => {
  await resetPhase3Fixtures(request);
  await openCrmIntakeSurface(page, "project-manager-a");

  await expect(page.getByTestId("opportunity-list")).toContainText("Внедрение портала АКМЕ");
  await page.getByLabel("Название возможности").fill("Внедрение клиентского портала E2E");
  await page.getByLabel("Клиент возможности").fill("Клиент E2E");
  await page.getByLabel("Контакт возможности").fill("Контакт E2E");
  await page.getByRole("button", { name: "Создать возможность" }).click();

  await expect(page.getByTestId("crm-intake-status")).toContainText("Возможность создана");
  await expect(page.getByTestId("selected-opportunity-title")).toContainText("Внедрение клиентского портала E2E");

  const opportunities = await listOpportunities(request, "project-manager-a");
  expect(opportunities.opportunities).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        tenantId: "tenant-a",
        title: "Внедрение клиентского портала E2E"
      })
    ])
  );
  const created = opportunities.opportunities.find((opportunity) => opportunity.title === "Внедрение клиентского портала E2E");
  expect(created?.contactIds.length).toBe(1);
  expect(created?.scopeHints.map((hint) => hint.key).sort()).toEqual(["integrations_count", "modules_count"]);

  await page.reload();
  await expect(page.getByTestId("crm-intake-surface")).toBeVisible();
  await expect(page.getByTestId("opportunity-list")).toContainText("Внедрение клиентского портала E2E");
});
