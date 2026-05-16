import { expect, test } from "@playwright/test";

import {
  getResourceLoad,
  openResourceLoadSurface,
  phase6Seed,
  resetPhase6Fixtures,
  tenantALoadBucketId
} from "./helpers";

test("E2E-050 resource load is visible from API and UI with deterministic seeded data", async ({ page, request }) => {
  await resetPhase6Fixtures(request);

  const apiLoad = await getResourceLoad(request);
  expect(apiLoad.resourceProfiles.map((profile) => profile.id)).toEqual(["resource-architect-a", "resource-engineer-a"]);
  expect(apiLoad.capacityCalendars.map((calendar) => calendar.id)).toContain("calendar-architect-a");
  expect(apiLoad.availabilityExceptions.map((exception) => exception.id)).toContain("reduced-architect-a-2026-06-03");
  expect(apiLoad.assignments.map((assignment) => assignment.id)).toContain(phase6Seed.tenantA.overload!.assignmentId);
  expect(apiLoad.reservations.map((reservation) => reservation.id)).toContain(phase6Seed.tenantA.overload!.reservationId);
  expect(apiLoad.loadBuckets.find((bucket) => bucket.id === tenantALoadBucketId)).toMatchObject(phase6Seed.tenantA.loadBucket);

  await openResourceLoadSurface(page);

  const bucketCard = page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`);
  await expect(bucketCard).toContainText("Анна Архитектор");
  await expect(bucketCard).toContainText("Емкость");
  await expect(bucketCard).toContainText("36 ч");
  await expect(bucketCard).toContainText("Назначено");
  await expect(bucketCard).toContainText("42 ч");
  await expect(bucketCard).toContainText("Резерв");
  await expect(bucketCard).toContainText("8 ч");
  await expect(bucketCard).toContainText("Итого");
  await expect(bucketCard).toContainText("50 ч");
  await expect(bucketCard).toContainText("Критическая");
  await expect(bucketCard).toContainText("138.89%");
});
