import { describe, expect, it } from "vitest";
import { createTenantUser } from "@kiss-pm/domain";
import {
  canManageAccessProfiles,
  canManageClients,
  canManageContacts,
  canManageDealStages,
  canManageOpportunities,
  canManagePositions,
  canManageProjectActivation,
  canManageProjectTypes,
  canManageProjects,
  canManageTenantUsers,
  canManageWorkspaceConfig,
  canManageWorkspaceTheme,
  canReadAuditEvents,
  canReadClients,
  canReadContacts,
  canReadDealStages,
  canReadOpportunities,
  canReadProjects,
  canReadProjectTypes,
  canReadResourceFeasibility,
  canReadTenantUsers,
  canReadWorkspaceConfig,
  canUpdateProfile,
  createAccessProfile
} from "./index";

describe("access-control tenant policy", () => {
  const adminProfile = createAccessProfile({
    id: "tenant-admin",
    permissions: [
      "tenant.users.read",
      "tenant.users.manage",
      "tenant.access_profiles.read",
      "tenant.access_profiles.manage",
      "tenant.positions.read",
      "tenant.positions.manage",
      "tenant.audit_events.read",
      "tenant.workspace_config.read",
      "tenant.workspace_config.manage",
      "tenant.clients.read",
      "tenant.clients.manage",
      "tenant.contacts.read",
      "tenant.contacts.manage",
      "tenant.project_types.read",
      "tenant.project_types.manage",
      "tenant.deal_stages.read",
      "tenant.deal_stages.manage",
      "tenant.opportunities.read",
      "tenant.opportunities.manage",
      "tenant.projects.read",
      "tenant.projects.manage",
      "tenant.project_activation.manage",
      "tenant.resource_feasibility.read",
      "profile.read",
      "profile.update",
      "workspace.theme.manage"
    ]
  });

  it("allows a user to read users in the same tenant when permission exists", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });

    const result = canReadTenantUsers({
      actor,
      profile: adminProfile,
      targetTenantId: "tenant-alpha"
    });

    expect(result).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
  });

  it("denies cross-tenant reads even when permission exists", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });

    const result = canReadTenantUsers({
      actor,
      profile: adminProfile,
      targetTenantId: "tenant-beta"
    });

    expect(result).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("denies same-tenant reads when permission is missing", () => {
    const readonlyProfile = createAccessProfile({
      id: "readonly",
      permissions: []
    });
    const actor = createTenantUser({
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      name: "Роман Наблюдатель",
      accessProfileId: readonlyProfile.id
    });

    const result = canReadTenantUsers({
      actor,
      profile: readonlyProfile,
      targetTenantId: "tenant-alpha"
    });

    expect(result).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
  });

  it("allows same-tenant access-profile management when permission exists", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });

    expect(
      canManageAccessProfiles({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
  });

  it("denies access-profile management when permission is missing", () => {
    const readonlyProfile = createAccessProfile({
      id: "readonly",
      permissions: ["tenant.users.read"]
    });
    const actor = createTenantUser({
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      name: "Роман Наблюдатель",
      accessProfileId: readonlyProfile.id
    });

    expect(
      canManageAccessProfiles({
        actor,
        profile: readonlyProfile,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
  });

  it("allows same-tenant audit reads when permission exists", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });

    expect(
      canReadAuditEvents({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
  });

  it("allows user, position, profile and theme management only when matching permissions exist", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });

    expect(
      canManageTenantUsers({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManagePositions({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canUpdateProfile({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageWorkspaceTheme({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
  });

  it("allows workspace config read and management only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const readonlyProfile = createAccessProfile({
      id: "readonly",
      permissions: ["tenant.workspace_config.read"]
    });

    expect(
      canReadWorkspaceConfig({
        actor,
        profile: readonlyProfile,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canManageWorkspaceConfig({
        actor,
        profile: readonlyProfile,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageWorkspaceConfig({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-beta"
      })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("allows Phase 3 opportunity, project and feasibility actions only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const intakeReader = createAccessProfile({
      id: "intake-reader",
      permissions: ["tenant.opportunities.read", "tenant.projects.read"]
    });

    expect(
      canReadOpportunities({
        actor,
        profile: intakeReader,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canReadProjects({
        actor,
        profile: intakeReader,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageOpportunities({
        actor,
        profile: intakeReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageOpportunities({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageProjects({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageProjectActivation({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canReadResourceFeasibility({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canReadResourceFeasibility({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-beta"
      })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("allows Phase 3.1 CRM foundation actions only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const crmReader = createAccessProfile({
      id: "crm-reader",
      permissions: [
        "tenant.clients.read",
        "tenant.contacts.read",
        "tenant.project_types.read",
        "tenant.deal_stages.read"
      ]
    });

    expect(
      canReadClients({ actor, profile: crmReader, targetTenantId: "tenant-alpha" })
        .allowed
    ).toBe(true);
    expect(
      canReadContacts({ actor, profile: crmReader, targetTenantId: "tenant-alpha" })
        .allowed
    ).toBe(true);
    expect(
      canReadProjectTypes({
        actor,
        profile: crmReader,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canReadDealStages({ actor, profile: crmReader, targetTenantId: "tenant-alpha" })
        .allowed
    ).toBe(true);
    expect(
      canManageClients({ actor, profile: crmReader, targetTenantId: "tenant-alpha" })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageClients({ actor, profile: adminProfile, targetTenantId: "tenant-alpha" })
        .allowed
    ).toBe(true);
    expect(
      canManageContacts({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageProjectTypes({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageDealStages({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canReadClients({ actor, profile: adminProfile, targetTenantId: "tenant-beta" })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });
});
