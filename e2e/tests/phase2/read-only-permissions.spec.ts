import { expect, test } from "@playwright/test";

import { getAuditEvents, openPhase2Surface, phase2ApiBaseUrl } from "./helpers";

test("E2E-012 Read-only user can open Phase 2 surface but cannot mutate directly", async ({ page, request }) => {
  await openPhase2Surface(page, "readonly-observer-a");

  await expect(page.getByTestId("readonly-denial")).toContainText(/режим чтения/i);
  await expect(page.getByRole("button", { name: "Создать профиль ревизора" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сохранить метку" })).toHaveCount(0);

  const deniedResponse = await request.post(`${phase2ApiBaseUrl()}/admin/access-profiles?testUser=readonly-observer-a`, {
    data: {
      id: "profile-readonly-direct-a",
      systemKey: "readonly_direct",
      label: "Запрещенный профиль",
      permissions: ["tenant.read"],
      scopeRules: [{ permissionKey: "tenant.read", scope: "tenant" }],
      active: true
    }
  });
  expect(deniedResponse.status()).toBe(403);
  expect(await deniedResponse.json()).toEqual(expect.objectContaining({ code: "permission_denied" }));

  const auditBody = await getAuditEvents(request, "tenant-admin-a");
  expect(auditBody.events.some((event) => event.target.entityId === "profile-readonly-direct-a")).toBe(false);
});
