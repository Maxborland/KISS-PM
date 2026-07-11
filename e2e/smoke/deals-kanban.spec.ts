import { expect, test } from "@playwright/test";

import {
  deactivateStaleSmokeOpportunityFields,
  getRequiredOpportunityCustomFieldValues,
  loginToWorkspace
} from "./smokeHelpers";

test("deals stage move persists after reload", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const opportunityId = `kanban-e2e-${suffix}`;
  const title = `Канбан проверка ${suffix}`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  await deactivateStaleSmokeOpportunityFields(page);
  const customFieldValues = await getRequiredOpportunityCustomFieldValues(page);

  const createResponse = await page.request.post("/api/workspace/opportunities", {
    data: {
      id: opportunityId,
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      title,
      description: "E2E проверка перемещения сделки по канбану",
      plannedStart: "2031-02-01",
      plannedFinish: "2031-02-28",
      contractValue: 600000,
      plannedHourlyRate: 6000,
      probability: 40,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 100 }],
      customFieldValues
    },
    headers: {
      "x-kiss-pm-action": "same-origin"
    }
  });
  expect(createResponse.status()).toBe(201);

  await page.goto("/crm/deals");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("radio", { name: "Список" }).locator("..").click();

  const listRow = page.getByRole("row", { name: new RegExp(title) });
  await expect(listRow).toBeVisible();
  await expect(listRow).toContainText("ООО Ромашка");
  await expect(listRow).toContainText("600 тыс");
  await expect(listRow).toContainText("40%");
  const stageSelect = listRow.locator("select");
  await expect(stageSelect).toHaveValue("deal-stage-new");

  await stageSelect.selectOption("deal-stage-qualified");
  await expect(stageSelect).toHaveValue("deal-stage-qualified");

  const apiReadback = await page.request.get("/api/workspace/opportunities");
  expect(apiReadback.status()).toBe(200);
  const apiPayload = await apiReadback.json() as {
    opportunities: Array<{ id: string; stageId: string }>;
  };
  expect(apiPayload.opportunities.find((opportunity) => opportunity.id === opportunityId)).toMatchObject({
    stageId: "deal-stage-qualified"
  });

  await page.reload();
  await page.getByRole("radio", { name: "Список" }).locator("..").click();
  const reloadedRow = page.getByRole("row", { name: new RegExp(title) });
  await expect(reloadedRow).toBeVisible();
  await expect(reloadedRow.locator("select")).toHaveValue("deal-stage-qualified");

  await page.getByRole("radio", { name: "Канбан" }).locator("..").click();
  await expect(page.locator("article").filter({ hasText: title })).toBeVisible();
  await expect(page.getByText("Drag-and-drop")).toHaveCount(0);
});