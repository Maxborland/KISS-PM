import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

describe("Phase 2 tenant and access API", () => {
  it("returns the current tenant, runtime labels, actor profile, and permissions", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request("/tenants/current?testUser=tenant-admin-a");

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      tenant: {
        id: "tenant-a",
        label: "Студия A",
        configurationVersion: 1
      },
      actor: {
        id: "tenant-admin-a",
        displayName: "Администратор",
        accessProfileId: "profile-tenant-admin-a"
      },
      labels: expect.objectContaining({
        "navigation.admin": "Администрирование",
        "role.project_manager": "Руководитель проекта"
      }),
      permissions: expect.arrayContaining(["tenant.read", "access_profile.write", "audit.read"])
    });
  });

  it("lists and upserts tenant-scoped access profiles with audit evidence", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const listBefore = await app.request("/admin/access-profiles?testUser=tenant-admin-a");
    expect(listBefore.status).toBe(200);
    const beforeBody = (await readJson(listBefore)) as { profiles: Array<{ id: string; tenantId: string }> };
    expect(beforeBody.profiles.map((profile) => profile.id)).toContain("profile-project-manager-a");
    expect(beforeBody.profiles.every((profile) => profile.tenantId === "tenant-a")).toBe(true);

    const upsert = await app.request(
      "/admin/access-profiles?testUser=tenant-admin-a",
      jsonRequest({
        id: "profile-phase2-reviewer-a",
        systemKey: "phase2_reviewer",
        label: "Ревизор доступа",
        permissions: ["tenant.read", "audit.read"],
        scopeRules: [
          { permissionKey: "tenant.read", scope: "tenant" },
          { permissionKey: "audit.read", scope: "tenant" }
        ],
        active: true
      })
    );
    expect(upsert.status).toBe(201);
    await expect(readJson(upsert)).resolves.toMatchObject({
      id: "profile-phase2-reviewer-a",
      tenantId: "tenant-a",
      systemKey: "phase2_reviewer",
      label: "Ревизор доступа",
      permissions: ["tenant.read", "audit.read"],
      version: 1
    });

    const audit = await app.request("/audit/events?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    const auditBody = (await readJson(audit)) as { events: Array<{ actionKey: string; target: { entityId: string } }> };
    expect(auditBody.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionKey: "access_profile.upsert",
          target: { entityType: "accessProfile", entityId: "profile-phase2-reviewer-a" }
        })
      ])
    );
  });

  it("updates tenant labels with version trace and rejects stale label writes without audit success", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const update = await app.request(
      "/admin/labels?testUser=tenant-admin-a",
      jsonRequest({
        key: "navigation.admin",
        label: "Настройки доступа",
        expectedConfigurationVersion: 1
      })
    );
    expect(update.status).toBe(200);
    await expect(readJson(update)).resolves.toEqual({
      tenantId: "tenant-a",
      configurationVersion: 2,
      previousConfigurationVersion: 1,
      changedLabel: {
        key: "navigation.admin",
        beforeLabel: "Администрирование",
        afterLabel: "Настройки доступа"
      },
      labels: expect.objectContaining({
        "navigation.admin": "Настройки доступа"
      })
    });

    const stale = await app.request(
      "/admin/labels?testUser=tenant-admin-a",
      jsonRequest({
        key: "navigation.admin",
        label: "Старое значение",
        expectedConfigurationVersion: 1
      })
    );
    expect(stale.status).toBe(409);
    await expect(readJson(stale)).resolves.toMatchObject({ code: "conflict" });

    const audit = await app.request("/audit/events?testUser=tenant-admin-a");
    const auditBody = (await readJson(audit)) as { events: Array<{ actionKey: string; details?: unknown }> };
    const labelEvents = auditBody.events.filter((event) => event.actionKey === "tenant_label.update");
    expect(labelEvents).toHaveLength(1);
    expect(labelEvents[0]).toMatchObject({
      details: {
        previousConfigurationVersion: 1,
        newConfigurationVersion: 2,
        changedLabel: {
          key: "navigation.admin",
          beforeLabel: "Администрирование",
          afterLabel: "Настройки доступа"
        }
      }
    });
  });

  it("rejects unknown tenant label keys before state changes or audit writes", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const rejected = await app.request(
      "/admin/labels?testUser=tenant-admin-a",
      jsonRequest({
        key: "navigation.unknown",
        label: "Не должно сохраниться",
        expectedConfigurationVersion: 1
      })
    );
    expect(rejected.status).toBe(400);
    await expect(readJson(rejected)).resolves.toMatchObject({ code: "validation_error" });

    const current = await app.request("/tenants/current?testUser=tenant-admin-a");
    await expect(readJson(current)).resolves.toMatchObject({
      tenant: { configurationVersion: 1 },
      labels: expect.not.objectContaining({
        "navigation.unknown": "Не должно сохраниться"
      })
    });

    const audit = await app.request("/audit/events?testUser=tenant-admin-a");
    const auditBody = (await readJson(audit)) as { events: Array<{ actionKey: string }> };
    expect(auditBody.events).toHaveLength(0);
  });

  it("rejects inherited tenant label keys before state changes or audit writes", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const rejected = await app.request(
      "/admin/labels?testUser=tenant-admin-a",
      jsonRequest({
        key: "toString",
        label: "Prototype pollution attempt",
        expectedConfigurationVersion: 1
      })
    );
    expect(rejected.status).toBe(400);
    await expect(readJson(rejected)).resolves.toMatchObject({ code: "validation_error" });

    const current = await app.request("/tenants/current?testUser=tenant-admin-a");
    await expect(readJson(current)).resolves.toMatchObject({
      tenant: { configurationVersion: 1 },
      labels: expect.not.objectContaining({
        toString: "Prototype pollution attempt"
      })
    });

    const audit = await app.request("/audit/events?testUser=tenant-admin-a");
    const auditBody = (await readJson(audit)) as { events: Array<{ actionKey: string }> };
    expect(auditBody.events).toHaveLength(0);
  });

  it("denies read-only direct mutations and does not write a success audit event", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const denied = await app.request(
      "/admin/access-profiles?testUser=readonly-observer-a",
      jsonRequest({
        id: "profile-forbidden-a",
        systemKey: "forbidden",
        label: "Запрещенный профиль",
        permissions: ["tenant.read"],
        scopeRules: [{ permissionKey: "tenant.read", scope: "tenant" }],
        active: true
      })
    );

    expect(denied.status).toBe(403);
    await expect(readJson(denied)).resolves.toMatchObject({ code: "permission_denied" });

    const audit = await app.request("/audit/events?testUser=tenant-admin-a");
    const auditBody = (await readJson(audit)) as { events: Array<{ target: { entityId: string } }> };
    expect(auditBody.events.some((event) => event.target.entityId === "profile-forbidden-a")).toBe(false);
  });

  it("returns safe permission diagnostics and probe denial without leaking cross-tenant details", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const diagnostic = await app.request(
      "/admin/permissions/evaluate?testUser=project-manager-a",
      jsonRequest({
        permissionKey: "tenant_probe.read",
        targetEntityType: "tenantIsolationProbe",
        targetEntityId: "probe-b-private",
        targetTenantId: "tenant-b",
        requestedScope: "tenant"
      })
    );
    expect(diagnostic.status).toBe(200);
    const diagnosticText = await diagnostic.text();
    expect(diagnosticText).toContain("tenant_mismatch");
    expect(diagnosticText).not.toContain("Закрытые данные Tenant B");
    expect(diagnosticText).not.toContain("probe-b-private");

    const ownProbe = await app.request("/tenant-isolation-probes/probe-a-private?testUser=project-manager-a");
    expect(ownProbe.status).toBe(200);
    await expect(readJson(ownProbe)).resolves.toEqual({
      id: "probe-a-private",
      tenantId: "tenant-a",
      label: "Закрытые данные Tenant A"
    });

    const crossProbe = await app.request("/tenant-isolation-probes/probe-b-private?testUser=project-manager-a");
    expect(crossProbe.status).toBe(404);
    const crossProbeText = await crossProbe.text();
    expect(crossProbeText).toContain("not_found");
    expect(crossProbeText).not.toContain("Закрытые данные Tenant B");
    expect(crossProbeText).not.toContain("probe-b-private");
  });

  it("resolves known diagnostic target ids before evaluating tenant scope", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const diagnostic = await app.request(
      "/admin/permissions/evaluate?testUser=project-manager-a",
      jsonRequest({
        permissionKey: "tenant_probe.read",
        targetEntityType: "tenantIsolationProbe",
        targetEntityId: "probe-b-private",
        requestedScope: "tenant"
      })
    );

    expect(diagnostic.status).toBe(200);
    const diagnosticText = await diagnostic.text();
    expect(diagnosticText).toContain("tenant_mismatch");
    expect(diagnosticText).not.toContain("probe-b-private");
    expect(diagnosticText).not.toContain("Закрытые данные Tenant B");
  });

  it("keeps fixture reset test-mode only and restores deterministic in-memory state", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const update = await app.request(
      "/admin/labels?testUser=tenant-admin-a",
      jsonRequest({
        key: "navigation.admin",
        label: "Сбросить это значение",
        expectedConfigurationVersion: 1
      })
    );
    expect(update.status).toBe(200);

    const reset = await app.request("/test-fixtures/reset", { method: "POST" });
    expect(reset.status).toBe(200);
    await expect(readJson(reset)).resolves.toEqual({ status: "reset" });

    const current = await app.request("/tenants/current?testUser=tenant-admin-a");
    await expect(readJson(current)).resolves.toMatchObject({
      tenant: { configurationVersion: 1 },
      labels: { "navigation.admin": "Администрирование" }
    });

    const productionLikeApp = createApiApp();
    const deniedReset = await productionLikeApp.request("/test-fixtures/reset", { method: "POST" });
    expect(deniedReset.status).toBe(403);
    await expect(readJson(deniedReset)).resolves.toMatchObject({ code: "test_mode_only" });
  });
});
