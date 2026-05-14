import { describe, expect, it } from "vitest";

import { getDemoTenants } from "./demoTenants";

describe("demo tenant fixtures", () => {
  it("returns deterministic tenant A and tenant B without real customer data", () => {
    const tenants = getDemoTenants();

    expect(tenants).toHaveLength(2);
    expect(tenants.map((tenant) => tenant.id)).toEqual(["tenant-a", "tenant-b"]);
    expect(tenants[0]?.users.map((user) => user.roleKey)).toEqual([
      "tenant_admin",
      "project_manager",
      "resource_manager",
      "executor",
      "readonly_observer"
    ]);
    expect(JSON.stringify(tenants)).not.toMatch(/bitrix|customer|production|secret/i);
  });
});

