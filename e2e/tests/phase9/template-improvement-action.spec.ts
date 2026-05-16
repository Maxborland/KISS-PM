import { expect, test } from "@playwright/test";

import {
  createClosedRetrospectivePair,
  getRetrospectiveAudit,
  getSnapshot,
  getTrends,
  jsonRequest,
  openClosedPortfolio,
  phase9ApiBaseUrl,
  resetPhase9Fixtures,
  tenantA,
  tenantB
} from "./helpers";

test("E2E-083 user creates template-improvement action with preview, audit, reload, and backend denial", async ({
  page,
  request
}) => {
  await resetPhase9Fixtures(request);
  const seeded = await createClosedRetrospectivePair(request);
  const trendsBefore = await getTrends(request);
  const insightId = trendsBefore.insights[0]!.id;
  const snapshotBefore = await getSnapshot(request, seeded.snapshotIds[0]);

  await openClosedPortfolio(page, tenantA.adminUserId);
  await page.getByRole("button", { name: "Открыть insight" }).first().click();
  await expect(page.getByTestId("retrospective-insight-panel")).toContainText(insightId);

  await page.getByRole("button", { name: "Предпросмотр улучшения" }).click();
  await expect(page.getByTestId("template-improvement-preview")).toContainText("Без мутации");
  expect((await getTrends(request)).insights.find((insight) => insight.id === insightId)?.status).toBe("open");
  expect(await getSnapshot(request, seeded.snapshotIds[0])).toEqual(snapshotBefore);

  const readOnlyPreview = await request.post(
    `${phase9ApiBaseUrl()}/api/retrospectives/insights/${encodeURIComponent(
      insightId
    )}/template-improvement/preview?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`,
    jsonRequest({ improvementKey: tenantA.templateImprovementKey, reason: "readonly attempt" })
  );
  expect(readOnlyPreview.status()).toBe(403);
  const tenantBPreview = await request.post(
    `${phase9ApiBaseUrl()}/api/retrospectives/insights/${encodeURIComponent(
      insightId
    )}/template-improvement/preview?testUser=${encodeURIComponent(tenantB.adminUserId)}`,
    jsonRequest({ improvementKey: tenantA.templateImprovementKey, reason: "wrong tenant" })
  );
  expect(tenantBPreview.status()).toBe(404);

  await page.getByRole("button", { name: "Применить улучшение" }).click();
  await expect(page.getByTestId("template-improvement-result")).toContainText("template_improvement.apply");
  await expect(page.getByTestId("retrospective-insight-panel")).toContainText("Статус: handled");

  const trendsAfter = await getTrends(request);
  expect(trendsAfter.insights.find((insight) => insight.id === insightId)?.status).toBe("handled");
  expect(await getSnapshot(request, seeded.snapshotIds[0])).toEqual(snapshotBefore);
  expect((await getRetrospectiveAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        commandType: "template_improvement.apply",
        source: { entityType: "retrospectiveInsight", entityId: insightId }
      })
    ])
  );

  await page.reload();
  await page.getByRole("button", { name: "Открыть insight" }).first().click();
  await expect(page.getByTestId("retrospective-insight-panel")).toContainText("Статус: handled");
  await expect(page.getByRole("button", { name: "Применить улучшение" })).toHaveCount(0);

  await resetPhase9Fixtures(request);
  expect((await getTrends(request)).insights).toEqual([]);
});
