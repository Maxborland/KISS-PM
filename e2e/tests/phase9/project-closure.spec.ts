import { expect, test } from "@playwright/test";

import {
  createClosableProject,
  getClosure,
  getRetrospectiveAudit,
  openProjectClosure,
  phase9ApiBaseUrl,
  resetPhase9Fixtures,
  tenantA,
  jsonRequest
} from "./helpers";

test("E2E-080 user closes project with required closure data, audit, reload, and cleanup", async ({ page, request }) => {
  await resetPhase9Fixtures(request);
  await createClosableProject(request, tenantA.closureProjectId);
  await openProjectClosure(page, tenantA.projectManagerUserId);

  await expect(page.getByTestId("project-closure-project-state")).toContainText("active");
  await expect(page.getByTestId("project-closure-checklist")).toContainText("Итог KPI");

  await page.getByRole("button", { name: "Предпросмотр закрытия" }).click();
  await expect(page.getByTestId("project-closure-preview")).toContainText("Без мутации");
  expect(await getClosure(request, tenantA.closureProjectId)).toMatchObject({
    project: { lifecycleStatus: "active" },
    snapshots: []
  });

  const readOnlyPreview = await request.post(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(tenantA.closureProjectId)}/closure/preview?testUser=${encodeURIComponent(
      tenantA.readOnlyUserId
    )}`,
    jsonRequest({ closureData: tenantA.closureData })
  );
  expect(readOnlyPreview.status()).toBe(403);

  await page.getByRole("button", { name: "Закрыть проект" }).click();
  await expect(page.getByTestId("project-closure-result")).toContainText("project.closure.apply");
  await expect(page.getByTestId("project-closure-latest-snapshot")).toContainText(`snapshot-${tenantA.closureProjectId}-1`);
  await expect(page.getByTestId("project-closure-audit")).toContainText("audit-");

  expect(await getClosure(request, tenantA.closureProjectId)).toMatchObject({
    project: { lifecycleStatus: "completed" },
    latestSnapshot: { id: `snapshot-${tenantA.closureProjectId}-1` }
  });
  expect((await getRetrospectiveAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "project.closure.apply" })])
  );

  await page.reload();
  await expect(page.getByTestId("project-closure-project-state")).toContainText("completed");
  await expect(page.getByTestId("project-closure-latest-snapshot")).toContainText(`snapshot-${tenantA.closureProjectId}-1`);

  await resetPhase9Fixtures(request);
  const afterReset = await request.get(
    `${phase9ApiBaseUrl()}/api/projects/${encodeURIComponent(tenantA.closureProjectId)}/closure?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`
  );
  expect(afterReset.status()).toBe(404);
});
