import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("runtime deals board persists a stage change @deal-stage-mutation", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);
  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(200);
  const mePayload = (await me.json()) as { permissions?: string[] };
  expect(mePayload.permissions).toContain("tenant.opportunities.manage");

  const opportunityId = "opportunity-beta-office-fitout";
  const targetStageId = "deal-stage-contract";

  await page.goto("/deals");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const response = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!response.ok) return [];
        const payload = (await response.json()) as { permissions?: string[] };
        return payload.permissions ?? [];
      })
    )
    .toContain("tenant.opportunities.manage");

  const sourceCard = page.locator(`[data-item-id="${opportunityId}"]`);
  const targetColumn = page.locator(`[data-col-id="${targetStageId}"]`);

  await expect(sourceCard).toBeVisible();
  await expect(sourceCard.locator("[data-dnd-active='true']")).toBeVisible();
  await expect(targetColumn).toBeVisible();

  const stageChange = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "PATCH" &&
      response.url().includes(`/api/workspace/opportunities/${opportunityId}/stage`)
    );
  });

  await pointerDragTo(page, sourceCard, targetColumn);
  await expect((await stageChange).status()).toBe(200);

  await page.reload();
  await expect(targetColumn.locator(`[data-item-id="${opportunityId}"]`)).toBeVisible();
});

async function pointerDragTo(
  page: Page,
  source: Locator,
  target: Locator
) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) return;

  const sourcePoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2
  };
  const targetPoint = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + Math.min(120, targetBox.height / 2)
  };

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.mouse.up();
}
