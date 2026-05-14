import { expect, test } from "@playwright/test";

import { openCrmIntakeSurface, resetPhase3Fixtures } from "./helpers";

test("E2E-021 Opportunity with missing intake fields shows explainable readiness blockers", async ({
  page,
  request
}) => {
  await resetPhase3Fixtures(request);
  await openCrmIntakeSurface(page, "project-manager-a");

  await page.getByRole("button", { name: "Создать с блокерами" }).click();
  await expect(page.getByTestId("crm-intake-status")).toContainText("Возможность с блокерами создана");
  await expect(page.getByTestId("selected-opportunity-title")).toContainText("Неполная возможность для приемки");

  await page.getByRole("button", { name: "Проверить готовность" }).click();
  await expect(page.getByTestId("crm-intake-status")).toContainText("Есть блокеры приемки");
  await expect(page.getByTestId("readiness-next-action")).toContainText("Заполнить недостающие данные");
  await expect(page.getByTestId("readiness-blockers")).toContainText("account_or_contact_missing");
  await expect(page.getByTestId("readiness-blockers")).toContainText("scope_hints_missing");
  await expect(page.getByTestId("readiness-blockers")).toContainText("template_match_missing");

  const directReadiness = await request.post(
    "http://127.0.0.1:" +
      `${process.env.PW_API_PORT ?? "4187"}/api/crm/opportunities/opportunity-tenant-a-2/readiness?testUser=project-manager-a`,
    { data: {} }
  );
  await expect(directReadiness).toBeOK();
  const body = (await directReadiness.json()) as { readiness: { ready: boolean; blockers: Array<{ code: string }> } };
  expect(body.readiness.ready).toBe(false);
  expect(body.readiness.blockers.map((blocker) => blocker.code)).toEqual(
    expect.arrayContaining(["account_or_contact_missing", "scope_hints_missing", "template_match_missing"])
  );
});
