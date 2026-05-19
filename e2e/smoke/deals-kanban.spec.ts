import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

test("deals kanban stage move persists after reload", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const opportunityId = `kanban-e2e-${suffix}`;
  const title = `Канбан проверка ${suffix}`;

  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });

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
      customFieldValues: {}
    },
    headers: {
      "x-kiss-pm-action": "same-origin"
    }
  });
  expect(createResponse.status()).toBe(201);

  await page.goto("/opportunities");
  await page.getByRole("button", { name: "Канбан" }).click();

  const kanban = page.getByLabel("Канбан сделок");
  const newColumn = page.getByRole("region", { name: "Этап Новая" });
  const qualifiedColumn = page.getByRole("region", { name: "Этап Квалификация" });
  const newCard = newColumn.locator("article").filter({ hasText: title });

  await expect(newCard).toBeVisible();
  await expect(newCard.getByRole("button", { name: new RegExp(`Перетащить сделку ${title}`) })).toBeVisible();

  await newCard.getByLabel("Сменить этап без перетаскивания").selectOption({
    label: "Квалификация"
  });

  await expect(qualifiedColumn.locator("article").filter({ hasText: title })).toBeVisible();
  await expect(newColumn.locator("article").filter({ hasText: title })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Канбан" }).click();

  await expect(kanban).toBeVisible();
  await expect(qualifiedColumn.locator("article").filter({ hasText: title })).toBeVisible();
});
