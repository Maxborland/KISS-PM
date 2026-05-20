import { expect, test } from "@playwright/test";

import {
  deactivateStaleSmokeOpportunityFields,
  getRequiredOpportunityCustomFieldValues,
  loginToWorkspace
} from "./smokeHelpers";

test("deals kanban stage move persists after reload", async ({ page }) => {
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

  await page.goto("/opportunities");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const listRow = page.getByRole("row", { name: new RegExp(title) });
  await expect(listRow).toContainText("Необходимые часы: 100 ч");
  await expect(listRow).not.toContainText("100 чНеобходимые");
  await expect(listRow).not.toContainText("/Норма");
  await page.getByRole("button", { name: "Канбан", exact: true }).click();

  const kanban = page.getByLabel("Канбан сделок");
  const newColumn = page.getByRole("region", { name: "Этап Новая" });
  const qualifiedColumn = page.getByRole("region", { name: "Этап Квалификация" });
  const newCard = newColumn.locator("article").filter({ hasText: title });

  await expect(newCard).toBeVisible();
  await expect(newCard).toContainText("ООО Ромашка");
  await expect(newCard).toContainText("Ирина Клиент");
  await expect(newCard).toContainText("01.02.2031 -> 28.02.2031");
  await expect(newCard).toContainText("Инженер: 100 ч");
  await expect(newCard).toContainText("Не проверено");
  await expect(newCard.getByRole("button", { name: new RegExp(`Перетащить сделку ${title}`) })).toBeVisible();
  await expect(newCard.getByText("Перетащите карточку или выберите этап")).toBeVisible();
  await expect(page.getByText("Drag-and-drop")).toHaveCount(0);

  await dragDealCardToColumn(
    page,
    newCard.getByRole("button", { name: new RegExp(`Перетащить сделку ${title}`) }),
    qualifiedColumn
  );

  await expect(qualifiedColumn.locator("article").filter({ hasText: title })).toBeVisible();
  await expect(newColumn.locator("article").filter({ hasText: title })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Канбан", exact: true }).click();

  await expect(kanban).toBeVisible();
  await expect(qualifiedColumn.locator("article").filter({ hasText: title })).toBeVisible();
});

async function dragDealCardToColumn(
  page: import("@playwright/test").Page,
  dragHandle: import("@playwright/test").Locator,
  targetColumn: import("@playwright/test").Locator
) {
  const handleBox = await dragHandle.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!handleBox || !targetBox) return;

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2 + 16
  );
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + Math.min(180, targetBox.height / 2),
    { steps: 18 }
  );
  await page.mouse.up();
}
