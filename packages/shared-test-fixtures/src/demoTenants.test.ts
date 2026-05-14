import { describe, expect, it } from "vitest";

import { getDemoTenants } from "./demoTenants";

describe("demo tenant fixtures", () => {
  it("returns deterministic tenant A and tenant B without real customer data", () => {
    const tenants = getDemoTenants();

    expect(tenants).toHaveLength(2);
    expect(tenants.map((tenant) => tenant.id)).toEqual(["tenant-a", "tenant-b"]);
    expect(tenants.map((tenant) => tenant.workspaces.map((workspace) => workspace.tenantId))).toEqual([
      ["tenant-a"],
      ["tenant-b"]
    ]);
    expect(tenants[0]?.users.map((user) => user.roleKey)).toEqual([
      "tenant_admin",
      "project_manager",
      "resource_manager",
      "executor",
      "readonly_observer"
    ]);
    expect(tenants[0]?.users.every((user) => user.tenantId === "tenant-a")).toBe(true);
    expect(tenants[1]?.users.every((user) => user.tenantId === "tenant-b")).toBe(true);
    expect(tenants.map((tenant) => tenant.isolationProbe.tenantId)).toEqual(["tenant-a", "tenant-b"]);
    expect(tenants[0]?.isolationProbe.id).toBe("probe-a-private");
    expect(tenants[1]?.isolationProbe.id).toBe("probe-b-private");
    expect(JSON.stringify(tenants)).not.toMatch(/bitrix|customer|production|secret/i);
  });
});
