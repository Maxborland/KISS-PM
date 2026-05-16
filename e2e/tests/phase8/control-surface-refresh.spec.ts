import { expect, test } from "@playwright/test";

import { getControlAudit, getPortfolioView, openPortfolioControl, portfolioActionPanel, resetPhase8Fixtures, tenantA } from "./helpers";

test("E2E-075 executed action refreshes Portfolio Control, persists on reload, and reset cleans state", async ({
  page,
  request
}) => {
  await resetPhase8Fixtures(request);
  await openPortfolioControl(page, tenantA.projectManagerUserId);

  await page.getByRole("button", { name: new RegExp(tenantA.warningSignalId) }).click();
  await expect(page.getByTestId("portfolio-control-detail")).toContainText(tenantA.warningSignalId);
  await page.getByRole("button", { name: "Запросить объяснение" }).click();
  await portfolioActionPanel(page).getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("portfolio-control-preview")).toContainText("signal.request_explanation");

  await portfolioActionPanel(page).getByRole("button", { name: "Применить после preview" }).click();
  await expect(page.getByTestId("portfolio-control-result")).toContainText("signal.request_explanation: succeeded");
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText("Запрошено объяснение");

  const viewAfter = await getPortfolioView(request);
  expect(viewAfter.rows.find((row) => row.id === tenantA.warningSignalRowId)?.explanation).toContain("Запрошено объяснение");
  const auditAfter = await getControlAudit(request);
  expect(auditAfter.actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        commandType: "signal.request_explanation",
        source: { entityType: "kpi_signal", entityId: tenantA.warningSignalId },
        inputSummary: expect.objectContaining({ requestedFrom: tenantA.projectManagerUserId })
      })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText("Запрошено объяснение");
  await expect(page.getByTestId("portfolio-control-audit")).toContainText("signal.request_explanation");

  await resetPhase8Fixtures(request);
  expect((await getControlAudit(request)).actionExecutions).toEqual([]);
  expect((await getPortfolioView(request)).rows.find((row) => row.id === tenantA.warningSignalRowId)?.explanation).not.toContain(
    "Запрошено объяснение"
  );
});
