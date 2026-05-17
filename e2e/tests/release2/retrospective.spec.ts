import { expect, test } from "@playwright/test";

import {
  createClosedRetrospectivePair,
  getRetrospectiveAudit,
  getSnapshot,
  getTrends,
  openClosedPortfolio,
  resetPhase9Fixtures,
  tenantA
} from "../phase9/helpers";

test("E2E-R2-007 Closed Portfolio: snapshot/trend to template-improvement action", async ({ page, request }) => {
  await resetPhase9Fixtures(request);
  const seeded = await createClosedRetrospectivePair(request);
  const trendsBefore = await getTrends(request);
  const insightId = trendsBefore.insights[0]!.id;
  const snapshotBefore = await getSnapshot(request, seeded.snapshotIds[0]!);

  await openClosedPortfolio(page, tenantA.adminUserId);
  await expect(page.getByTestId("closed-portfolio-surface")).toContainText("ProjectSnapshot");
  await page.getByRole("button", { name: "Открыть insight" }).first().click();
  await expect(page.getByTestId("retrospective-insight-panel")).toContainText(insightId);

  await page.getByRole("button", { name: "Предпросмотр улучшения" }).click();
  await expect(page.getByTestId("template-improvement-preview")).toContainText("Без мутации");
  expect(await getSnapshot(request, seeded.snapshotIds[0]!)).toEqual(snapshotBefore);

  await page.getByRole("button", { name: "Применить улучшение" }).click();
  await expect(page.getByTestId("template-improvement-result")).toContainText("template_improvement.apply");
  expect((await getTrends(request)).insights.find((insight) => insight.id === insightId)?.status).toBe("handled");
  expect((await getRetrospectiveAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "template_improvement.apply" })])
  );
  expect(await getSnapshot(request, seeded.snapshotIds[0]!)).toEqual(snapshotBefore);
});
