import { expect, test } from "@playwright/test";

import {
  createClosedRetrospectivePair,
  getClosedPortfolio,
  getTrends,
  openClosedPortfolio,
  resetPhase9Fixtures,
  tenantA
} from "./helpers";

test("E2E-082 user opens closed portfolio and sees snapshot-based trend metrics with reload and cleanup", async ({
  page,
  request
}) => {
  await resetPhase9Fixtures(request);
  const seeded = await createClosedRetrospectivePair(request);
  await openClosedPortfolio(page, tenantA.adminUserId);

  await expect(page.getByTestId("closed-portfolio-summary")).toContainText("Снимки: 2");
  await expect(page.getByTestId("closed-portfolio-detail")).toContainText(seeded.snapshotIds[0]);
  await expect(page.getByTestId("retrospective-trend-list")).toContainText("Повторяющаяся задержка");

  const portfolio = await getClosedPortfolio(request);
  expect(portfolio.summary).toMatchObject({ totalSnapshots: 2 });
  expect(portfolio.rows.map((row) => row.entityId)).toEqual(expect.arrayContaining(seeded.snapshotIds));
  const trends = await getTrends(request);
  expect(trends.trends[0]).toMatchObject({
    severity: "critical",
    sourceSnapshotIds: expect.arrayContaining(seeded.snapshotIds)
  });

  await page.reload();
  await expect(page.getByTestId("closed-portfolio-summary")).toContainText("Снимки: 2");
  await expect(page.getByTestId("retrospective-trend-list")).toContainText("Повторяющаяся задержка");

  await resetPhase9Fixtures(request);
  expect((await getClosedPortfolio(request)).summary.totalSnapshots).toBe(0);
});
