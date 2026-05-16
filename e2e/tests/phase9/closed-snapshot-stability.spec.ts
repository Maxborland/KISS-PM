import { expect, test } from "@playwright/test";

import {
  closeProjectWithApi,
  createClosableProject,
  getSnapshot,
  jsonRequest,
  openClosedPortfolio,
  phase9ApiBaseUrl,
  resetPhase9Fixtures,
  tenantA
} from "./helpers";

test("E2E-081 closed snapshot remains stable after later live changes, mutation denial, reload, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase9Fixtures(request);
  const projectId = await createClosableProject(request, "project-phase9-e2e-stability-a");
  const closed = await closeProjectWithApi(request, projectId);
  const snapshotBefore = await getSnapshot(request, closed.result.snapshotId);

  const mutateSnapshot = await request.patch(
    `${phase9ApiBaseUrl()}/api/retrospectives/snapshots/${encodeURIComponent(
      closed.result.snapshotId
    )}?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`,
    jsonRequest({ project: { title: "mutated" } })
  );
  expect(mutateSnapshot.status()).toBe(405);

  const liveTaskChange = await request.patch(
    `${phase9ApiBaseUrl()}/api/tasks/${encodeURIComponent(`${projectId}:delivery-task`)}/status?testUser=${encodeURIComponent(
      tenantA.projectManagerUserId
    )}`,
    jsonRequest({ toStatus: "in_progress" })
  );
  expect([200, 400, 409]).toContain(liveTaskChange.status());

  expect(await getSnapshot(request, closed.result.snapshotId)).toEqual(snapshotBefore);
  await openClosedPortfolio(page, tenantA.adminUserId);
  await expect(page.getByTestId("closed-portfolio-detail")).toContainText(closed.result.snapshotId);
  await page.reload();
  await expect(page.getByTestId("closed-portfolio-detail")).toContainText(closed.result.snapshotId);

  await resetPhase9Fixtures(request);
  const afterReset = await request.get(
    `${phase9ApiBaseUrl()}/api/retrospectives/snapshots/${encodeURIComponent(
      closed.result.snapshotId
    )}?testUser=${encodeURIComponent(tenantA.projectManagerUserId)}`
  );
  expect(afterReset.status()).toBe(404);
});
