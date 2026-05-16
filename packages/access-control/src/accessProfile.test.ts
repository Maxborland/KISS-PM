import { describe, expect, it } from "vitest";

import {
  AccessControlModelError,
  TENANT_CONFIG_IMPORT_PERMISSION,
  TENANT_CONFIG_READ_PERMISSION,
  TENANT_CONFIG_WRITE_PERMISSION,
  createAccessProfile,
  createPermission,
  createProfileAssignment,
  createScopeRule
} from "./index";

describe("access profile model", () => {
  const tenantRead = createPermission({
    key: "tenant.read",
    description: "Read current tenant",
    category: "tenant_administration"
  });
  const profileRead = createPermission({
    key: "access_profile.read",
    description: "Read access profiles",
    category: "access_profile_administration"
  });

  it("creates a tenant-owned versioned access profile with permissions and scope rules", () => {
    const profile = createAccessProfile({
      id: "profile-project-manager-a",
      tenantId: "tenant-a",
      systemKey: "project_manager",
      label: "Руководитель проекта",
      permissions: [tenantRead, profileRead],
      scopeRules: [
        createScopeRule({ permissionKey: "tenant.read", scope: "tenant" }),
        createScopeRule({ permissionKey: "access_profile.read", scope: "own" })
      ],
      active: true,
      version: 3,
      updatedAt: "2026-05-14T12:40:00+07:00"
    });

    expect(profile).toEqual({
      id: "profile-project-manager-a",
      tenantId: "tenant-a",
      systemKey: "project_manager",
      label: "Руководитель проекта",
      permissions: ["tenant.read", "access_profile.read"],
      scopeRules: [
        { permissionKey: "tenant.read", scope: "tenant" },
        { permissionKey: "access_profile.read", scope: "own" }
      ],
      active: true,
      version: 3,
      updatedAt: "2026-05-14T12:40:00+07:00"
    });
  });

  it("supports tenant configuration permissions for P10 builders", () => {
    const profile = createAccessProfile({
      id: "tenant-admin-profile",
      tenantId: "tenant-a",
      systemKey: "tenant_admin",
      label: "Tenant admin",
      permissions: [
        TENANT_CONFIG_READ_PERMISSION,
        TENANT_CONFIG_WRITE_PERMISSION,
        TENANT_CONFIG_IMPORT_PERMISSION
      ],
      scopeRules: [
        createScopeRule({ permissionKey: TENANT_CONFIG_READ_PERMISSION.key, scope: "tenant" }),
        createScopeRule({ permissionKey: TENANT_CONFIG_WRITE_PERMISSION.key, scope: "tenant" }),
        createScopeRule({ permissionKey: TENANT_CONFIG_IMPORT_PERMISSION.key, scope: "tenant" })
      ],
      active: true,
      version: 1,
      updatedAt: "2026-05-17T02:30:00+07:00"
    });

    expect(profile.permissions).toEqual([
      "tenant.config.read",
      "tenant.config.write",
      "tenant.config.import"
    ]);
  });

  it("rejects missing tenant ownership and invalid profile version", () => {
    expect(() =>
      createAccessProfile({
        id: "profile-without-tenant",
        tenantId: "",
        systemKey: "broken",
        label: "Broken",
        permissions: [tenantRead],
        scopeRules: [],
        active: true,
        version: 1,
        updatedAt: "2026-05-14T12:40:00+07:00"
      })
    ).toThrow("tenantId is required");

    expect(() =>
      createAccessProfile({
        id: "profile-zero-version",
        tenantId: "tenant-a",
        systemKey: "broken",
        label: "Broken",
        permissions: [tenantRead],
        scopeRules: [],
        active: true,
        version: 0,
        updatedAt: "2026-05-14T12:40:00+07:00"
      })
    ).toThrow("version must be a positive integer");
  });

  it("rejects duplicate permission keys and scope rules without matching permissions", () => {
    expect(() =>
      createAccessProfile({
        id: "profile-duplicate-permissions",
        tenantId: "tenant-a",
        systemKey: "duplicate",
        label: "Duplicate",
        permissions: [tenantRead, tenantRead],
        scopeRules: [],
        active: true,
        version: 1,
        updatedAt: "2026-05-14T12:40:00+07:00"
      })
    ).toThrow("Duplicate permission key: tenant.read");

    expect(() =>
      createAccessProfile({
        id: "profile-missing-permission",
        tenantId: "tenant-a",
        systemKey: "missing_permission",
        label: "Missing permission",
        permissions: [tenantRead],
        scopeRules: [createScopeRule({ permissionKey: "access_profile.read", scope: "tenant" })],
        active: true,
        version: 1,
        updatedAt: "2026-05-14T12:40:00+07:00"
      })
    ).toThrow("Scope rule references permission that is not assigned: access_profile.read");
  });

  it("allows only Phase 2 supported scope values in profile rules", () => {
    expect(createScopeRule({ permissionKey: "tenant.read", scope: "own" }).scope).toBe("own");
    expect(createScopeRule({ permissionKey: "tenant.read", scope: "project" }).scope).toBe("project");
    expect(createScopeRule({ permissionKey: "tenant.read", scope: "tenant" }).scope).toBe("tenant");
    expect(createScopeRule({ permissionKey: "tenant.read", scope: "all" }).scope).toBe("all");

    expect(() => createScopeRule({ permissionKey: "tenant.read", scope: "team" })).toThrow(
      "Unsupported scope for profile rule: team"
    );
    expect(() => createScopeRule({ permissionKey: "tenant.read", scope: "department" })).toThrow(
      "Unsupported scope for profile rule: department"
    );
  });

  it("revalidates scope rules when creating a profile from deserialized data", () => {
    expect(() =>
      createAccessProfile({
        id: "profile-deserialized-scope",
        tenantId: "tenant-a",
        systemKey: "deserialized_scope",
        label: "Deserialized scope",
        permissions: [tenantRead],
        scopeRules: [{ permissionKey: "tenant.read", scope: "team" as never }],
        active: true,
        version: 1,
        updatedAt: "2026-05-14T12:40:00+07:00"
      })
    ).toThrow("Unsupported scope for profile rule: team");
  });

  it("rejects non-boolean active flags from deserialized data", () => {
    expect(() =>
      createAccessProfile({
        id: "profile-invalid-active",
        tenantId: "tenant-a",
        systemKey: "invalid_active",
        label: "Invalid active",
        permissions: [tenantRead],
        scopeRules: [],
        active: "true" as never,
        version: 1,
        updatedAt: "2026-05-14T12:40:00+07:00"
      })
    ).toThrow("accessProfile.active must be a boolean");
  });

  it("creates tenant-owned profile assignments for diagnostics", () => {
    const assignment = createProfileAssignment({
      id: "assignment-admin-a",
      tenantId: "tenant-a",
      userId: "tenant-admin-a",
      accessProfileId: "profile-tenant-admin-a",
      assignedAt: "2026-05-14T12:41:00+07:00"
    });

    expect(assignment).toEqual({
      id: "assignment-admin-a",
      tenantId: "tenant-a",
      userId: "tenant-admin-a",
      accessProfileId: "profile-tenant-admin-a",
      assignedAt: "2026-05-14T12:41:00+07:00"
    });
  });

  it("throws typed access-control model errors", () => {
    try {
      createPermission({
        key: "",
        description: "Broken",
        category: "tenant_administration"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AccessControlModelError);
      expect((error as AccessControlModelError).code).toBe("validation_error");
    }
  });
});
