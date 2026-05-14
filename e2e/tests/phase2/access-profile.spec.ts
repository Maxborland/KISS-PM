import { expect, test } from "@playwright/test";

import { getAuditEvents, openPhase2Surface, phase2ApiBaseUrl, resetPhase2Fixtures } from "./helpers";

test("E2E-011 Admin can create an access profile through UI and audit readback", async ({ page, request }) => {
  await resetPhase2Fixtures(request);
  await openPhase2Surface(page, "tenant-admin-a");

  await expect(page.getByTestId("access-profile-list")).toContainText("Администратор тенанта");
  await page.getByRole("button", { name: "Создать профиль ревизора" }).click();
  await expect(page.getByTestId("phase2-status")).toContainText("Профиль доступа сохранен");
  await expect(page.getByTestId("access-profile-list")).toContainText("Ревизор доступа");

  const profilesResponse = await request.get(`${phase2ApiBaseUrl()}/admin/access-profiles?testUser=tenant-admin-a`);
  await expect(profilesResponse).toBeOK();
  const profilesBody = (await profilesResponse.json()) as { profiles: Array<{ id: string; label: string }> };
  expect(profilesBody.profiles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "profile-ui_reviewer-tenant-a",
        label: "Ревизор доступа"
      })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("phase2-admin-surface")).toBeVisible();
  await expect(page.getByTestId("access-profile-list")).toContainText("Ревизор доступа");

  const auditBody = await getAuditEvents(request, "tenant-admin-a");
  expect(auditBody.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actorId: "tenant-admin-a",
        actionKey: "access_profile.upsert",
        target: { entityType: "accessProfile", entityId: "profile-ui_reviewer-tenant-a" },
        result: "success"
      })
    ])
  );
});
