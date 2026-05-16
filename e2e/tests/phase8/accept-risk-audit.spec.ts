import { expect, test } from "@playwright/test";

import {
  getControlAudit,
  getPortfolioView,
  jsonRequest,
  kpiTarget,
  openPortfolioControl,
  portfolioActionPanel,
  phase8ApiBaseUrl,
  resetPhase8Fixtures,
  tenantA
} from "./helpers";

test("E2E-073 authorized user accepts risk with mandatory reason, audit, refresh, and reset cleanup", async ({
  page,
  request
}) => {
  await resetPhase8Fixtures(request);

  const missingReason = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(tenantA.actions.acceptRisk)}/preview?testUser=${encodeURIComponent(
      tenantA.adminUserId
    )}`,
    jsonRequest({ target: kpiTarget(), input: {} })
  );
  expect(missingReason.status()).toBe(400);
  await expect(missingReason.json()).resolves.toMatchObject({ code: "validation_error" });

  await openPortfolioControl(page, tenantA.adminUserId);
  await page.getByRole("button", { name: "Принять риск" }).click();
  await portfolioActionPanel(page).getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("portfolio-control-preview")).toContainText("risk.accept");
  expect((await getControlAudit(request)).actionExecutions).toEqual([]);

  await portfolioActionPanel(page).getByRole("button", { name: "Применить после preview" }).click();
  await expect(page.getByTestId("portfolio-control-result")).toContainText("risk.accept: succeeded");
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText("Риск принят");

  const auditAfter = await getControlAudit(request);
  expect(auditAfter.actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        commandType: "risk.accept",
        source: { entityType: "kpi_signal", entityId: tenantA.criticalSignalId },
        inputSummary: expect.objectContaining({ reason: "Контролируемый риск до перепланирования" })
      })
    ])
  );
  expect((await getPortfolioView(request, tenantA.adminUserId)).rows.find((row) => row.id === tenantA.criticalSignalRowId)?.explanation).toContain(
    "Риск принят"
  );

  await page.reload();
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText("Риск принят");
  await expect(page.getByTestId("portfolio-control-audit")).toContainText("risk.accept");

  await resetPhase8Fixtures(request);
  expect((await getControlAudit(request)).actionExecutions).toEqual([]);
  expect((await getPortfolioView(request, tenantA.adminUserId)).rows.find((row) => row.id === tenantA.criticalSignalRowId)?.explanation).not.toContain(
    "Риск принят"
  );
});
