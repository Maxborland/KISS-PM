import { expect, test } from "@playwright/test";

import {
  getOverloadDetail,
  openResourceLoadSurface,
  phase6Seed,
  resetPhase6Fixtures,
  tenantAOverloadId
} from "./helpers";

test("E2E-051 overload detection is visible and reproducible", async ({ page, request }) => {
  await resetPhase6Fixtures(request);

  const overloadDetail = await getOverloadDetail(request);
  expect(overloadDetail.overload).toMatchObject({
    id: tenantAOverloadId,
    severity: "critical",
    overloadHours: 14,
    affectedTaskIds: ["task-design-a"],
    affectedProjectIds: ["project-alpha-a", "project-draft-alpha-a"]
  });
  expect(overloadDetail.overload.explanation).toContain("Перегрузка 14 ч.");
  expect(overloadDetail.affectedAssignments.map((assignment) => assignment.id)).toEqual([
    phase6Seed.tenantA.overload!.assignmentId
  ]);
  expect(overloadDetail.affectedReservations.map((reservation) => reservation.id)).toEqual([
    phase6Seed.tenantA.overload!.reservationId
  ]);

  await openResourceLoadSurface(page);

  const signal = page.getByTestId("resource-overload-signal");
  await expect(signal).toContainText(tenantAOverloadId);
  await expect(signal).toContainText("Анна Архитектор");
  await expect(signal).toContainText("2026-06-01..2026-06-05");
  await expect(signal).toContainText("Критическая");
  await expect(signal).toContainText("14 ч");
  await expect(signal).toContainText(phase6Seed.tenantA.overload!.assignmentId);
  await expect(signal).toContainText(phase6Seed.tenantA.overload!.reservationId);
  await expect(signal).toContainText("Перенести работу");
});
