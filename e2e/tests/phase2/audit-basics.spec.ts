import { expect, test } from "@playwright/test";

import { getAuditEvents, openPhase2Surface, resetPhase2Fixtures } from "./helpers";

test("E2E-014 Auditable Phase 2 action records actor, tenant, timestamp, result, and is tenant-scoped", async ({
  page,
  request
}) => {
  await resetPhase2Fixtures(request);
  await openPhase2Surface(page, "tenant-admin-a");

  await page.getByLabel("Метка раздела администрирования").fill("Аудит действий");
  await page.getByRole("button", { name: "Сохранить метку" }).click();
  await expect(page.getByTestId("phase2-status")).toContainText("Метка сохранена");
  await expect(page.getByTestId("audit-events")).toContainText("tenant_label.update");

  const tenantAAudit = await getAuditEvents(request, "tenant-admin-a");
  expect(tenantAAudit.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "tenant_label.update",
        target: { entityType: "tenantLabel", entityId: "navigation.admin" },
        result: "success",
        timestamp: expect.any(String),
        correlationId: expect.stringMatching(/^corr-/)
      })
    ])
  );

  const tenantBAudit = await getAuditEvents(request, "tenant-admin-b");
  expect(tenantBAudit.events.every((event) => event.tenantId === "tenant-b")).toBe(true);
  expect(tenantBAudit.events.some((event) => event.actorId === "tenant-admin-a")).toBe(false);
});
