import { describe, expect, it } from "vitest";

import {
  assertTenantMatch,
  createActorContext,
  createTenant,
  createTenantContext,
  createTenantIsolationProbe,
  createTenantUser,
  createWorkspace,
  DomainInvariantError
} from "./index";

describe("tenant and workspace primitives", () => {
  it("creates tenant-owned primitives with explicit tenant ownership", () => {
    const tenant = createTenant({
      id: "tenant-a",
      label: "Студия A",
      configurationVersion: 1
    });
    const workspace = createWorkspace({
      id: "workspace-a-main",
      tenantId: tenant.id,
      label: "Основное пространство"
    });
    const user = createTenantUser({
      id: "project-manager-a",
      tenantId: tenant.id,
      displayName: "Руководитель проекта",
      accessProfileId: "profile-project-manager-a"
    });
    const probe = createTenantIsolationProbe({
      id: "probe-a-private",
      tenantId: tenant.id,
      label: "Закрытые данные Tenant A"
    });

    expect(workspace.tenantId).toBe(tenant.id);
    expect(user.tenantId).toBe(tenant.id);
    expect(probe.tenantId).toBe(tenant.id);
  });

  it("rejects primitives with missing tenant ownership", () => {
    expect(() =>
      createWorkspace({
        id: "workspace-without-tenant",
        tenantId: "",
        label: "Broken workspace"
      })
    ).toThrow(DomainInvariantError);
    expect(() =>
      createTenantUser({
        id: "user-without-tenant",
        tenantId: "   ",
        displayName: "Broken user"
      })
    ).toThrow("tenantId is required");
  });

  it("guards tenant mismatch without exposing target details", () => {
    const context = createTenantContext({ tenantId: "tenant-a" });
    const tenantBProbe = createTenantIsolationProbe({
      id: "probe-b-private",
      tenantId: "tenant-b",
      label: "Tenant B private label"
    });

    expect(() => assertTenantMatch(context, tenantBProbe)).toThrow(DomainInvariantError);

    try {
      assertTenantMatch(context, tenantBProbe);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainInvariantError);
      expect((error as DomainInvariantError).code).toBe("tenant_mismatch");
      expect((error as DomainInvariantError).message).not.toContain("Tenant B private label");
    }
  });

  it("creates actor context tied to one active tenant", () => {
    const actor = createActorContext({
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      accessProfileId: "profile-tenant-admin-a",
      correlationId: "corr-phase2-001"
    });

    expect(actor).toEqual({
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      accessProfileId: "profile-tenant-admin-a",
      correlationId: "corr-phase2-001"
    });
  });

  it("rejects empty optional diagnostic identifiers when they are provided", () => {
    expect(() =>
      createTenantUser({
        id: "broken-user",
        tenantId: "tenant-a",
        displayName: "Broken user",
        accessProfileId: ""
      })
    ).toThrow("accessProfileId is required");

    expect(() =>
      createActorContext({
        tenantId: "tenant-a",
        actorId: "broken-actor",
        accessProfileId: "   "
      })
    ).toThrow("accessProfileId is required");

    expect(() =>
      createActorContext({
        tenantId: "tenant-a",
        actorId: "broken-actor",
        correlationId: ""
      })
    ).toThrow("correlationId is required");
  });
});
