import { expect, test } from "@playwright/test";

import { getAuditEvents, openPhase2Surface, phase2ApiBaseUrl, resetPhase2Fixtures } from "./helpers";

test("P2-009 deterministic fixture reset restores Phase 2 seed before scenarios", async ({ page, request }) => {
  await resetPhase2Fixtures(request);
  await openPhase2Surface(page, "tenant-admin-a");

  await page.getByRole("button", { name: "Создать профиль ревизора" }).click();
  await expect(page.getByTestId("phase2-status")).toContainText("Профиль доступа сохранен");
  await page.getByLabel("Метка раздела администрирования").fill("Сброс фикстур");
  await page.getByRole("button", { name: "Сохранить метку" }).click();
  await expect(page.getByTestId("phase2-status")).toContainText("Метка сохранена");

  const dirtyAudit = await getAuditEvents(request, "tenant-admin-a");
  expect(dirtyAudit.events.length).toBeGreaterThan(0);

  await resetPhase2Fixtures(request);

  const currentResponse = await request.get(`${phase2ApiBaseUrl()}/tenants/current?testUser=tenant-admin-a`);
  await expect(currentResponse).toBeOK();
  const currentBody = (await currentResponse.json()) as {
    labels: Record<string, string>;
    tenant: { configurationVersion: number };
  };
  expect(currentBody.tenant.configurationVersion).toBe(1);
  expect(currentBody.labels["navigation.admin"]).toBe("Администрирование");

  const profilesResponse = await request.get(`${phase2ApiBaseUrl()}/admin/access-profiles?testUser=tenant-admin-a`);
  await expect(profilesResponse).toBeOK();
  const profilesBody = (await profilesResponse.json()) as { profiles: Array<{ id: string }> };
  expect(profilesBody.profiles.map((profile) => profile.id)).not.toContain("profile-ui_reviewer-tenant-a");

  const cleanAudit = await getAuditEvents(request, "tenant-admin-a");
  expect(cleanAudit.events).toEqual([]);

  const tenantBCurrentResponse = await request.get(`${phase2ApiBaseUrl()}/tenants/current?testUser=tenant-admin-b`);
  await expect(tenantBCurrentResponse).toBeOK();
  const tenantBCurrentBody = (await tenantBCurrentResponse.json()) as {
    labels: Record<string, string>;
    tenant: { id: string; configurationVersion: number };
  };
  expect(tenantBCurrentBody.tenant).toEqual(
    expect.objectContaining({
      id: "tenant-b",
      configurationVersion: 1
    })
  );
  expect(tenantBCurrentBody.labels["navigation.admin"]).toBe("Администрирование B");

  const tenantBProbeResponse = await request.get(
    `${phase2ApiBaseUrl()}/tenant-isolation-probes/probe-b-private?testUser=tenant-admin-b`
  );
  await expect(tenantBProbeResponse).toBeOK();
  await expect(tenantBProbeResponse.json()).resolves.toEqual({
    id: "probe-b-private",
    tenantId: "tenant-b",
    label: "Закрытые данные Tenant B"
  });
});
