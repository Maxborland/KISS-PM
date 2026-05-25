import { describe, expect, it } from "vitest";
import { createTenantUser } from "@kiss-pm/domain";
import {
  canManageAccessProfiles,
  canManageClients,
  canManageContacts,
  canManageDealStages,
  canManageOpportunities,
  canManagePositions,
  canManageProjectBaselines,
  canManageProjectPlan,
  canManageProjectResources,
  canManageProducts,
  canManageProjectActivation,
  canManageProjectTypes,
  canManageProjects,
  canManageTaskStatuses,
  canManageControlSignals,
  canManageCorrectiveActions,
  canManageControlSurfaces,
  canManageRetrospectives,
  canManageKpiDefinitions,
  canPublishControlSurfaces,
  canApplyTemplateImprovements,
  canCreateTasks,
  canDeleteTasks,
  canEditTasks,
  canExecuteManagementActions,
  canManageTenantUsers,
  canManageWorkspaceConfig,
  canManageWorkspaceTheme,
  canReadAuditEvents,
  canReadClients,
  canReadContacts,
  canReadDealStages,
  canReadOpportunities,
  canReadProducts,
  canReadProjectPlan,
  canReadProjectResources,
  canReadProjects,
  canReadProjectTypes,
  canReadResourceFeasibility,
  canReadControlSignals,
  canReadControlSurfaces,
  canReadRetrospectives,
  canReadKpiDefinitions,
  canReadTenantUsers,
  canReadWorkspaceConfig,
  canPreviewPlanningScenarios,
  canApplyPlanningScenarios,
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
      "tenant.products.read",
      "tenant.products.manage",
      "tenant.project_types.read",
      "tenant.project_types.manage",
      "tenant.deal_stages.read",
      "tenant.deal_stages.manage",
      "tenant.opportunities.read",
      "tenant.opportunities.manage",
      "tenant.projects.read",
      "tenant.projects.manage",
      "tenant.project_plan.read",
      "tenant.project_plan.manage",
      "tenant.project_baselines.manage",
      "tenant.project_resources.read",
      "tenant.project_resources.manage",
      "tenant.planning_scenarios.preview",
      "tenant.planning_scenarios.apply",
      "tenant.kpi_definitions.read",
      "tenant.kpi_definitions.manage",
      "tenant.control_signals.read",
      "tenant.control_signals.manage",
      "tenant.management_actions.execute",
      "tenant.corrective_actions.manage",
      "tenant.control_surfaces.read",
      "tenant.control_surfaces.manage",
      "tenant.control_surfaces.publish",
      "tenant.retrospectives.read",
      "tenant.retrospectives.manage",
      "tenant.template_improvements.apply",
      "tenant.tasks.create",
      "tenant.tasks.edit",
      "tenant.tasks.delete",
      "tenant.task_statuses.manage",
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
        "tenant.products.read",
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
      canReadProducts({ actor, profile: crmReader, targetTenantId: "tenant-alpha" })
        .allowed
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
      canManageProducts({ actor, profile: crmReader, targetTenantId: "tenant-alpha" })
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
      canManageProducts({
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

  it("allows Phase 4.2 task actions only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const taskCreator = createAccessProfile({
      id: "task-creator",
      permissions: ["tenant.projects.read", "tenant.tasks.create"]
    });

    expect(
      canCreateTasks({ actor, profile: taskCreator, targetTenantId: "tenant-alpha" })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canEditTasks({ actor, profile: taskCreator, targetTenantId: "tenant-alpha" })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canDeleteTasks({ actor, profile: taskCreator, targetTenantId: "tenant-alpha" })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageTaskStatuses({
        actor,
        profile: taskCreator,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageTaskStatuses({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canEditTasks({ actor, profile: adminProfile, targetTenantId: "tenant-beta" })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("allows Phase 5/6 planning actions only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const planReader = createAccessProfile({
      id: "plan-reader",
      permissions: ["tenant.project_plan.read", "tenant.project_resources.read"]
    });

    expect(
      canReadProjectPlan({ actor, profile: planReader, targetTenantId: "tenant-alpha" })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canReadProjectResources({ actor, profile: planReader, targetTenantId: "tenant-alpha" })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canManageProjectPlan({ actor, profile: planReader, targetTenantId: "tenant-alpha" })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageProjectPlan({ actor, profile: adminProfile, targetTenantId: "tenant-alpha" })
        .allowed
    ).toBe(true);
    expect(
      canManageProjectBaselines({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageProjectResources({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canPreviewPlanningScenarios({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canApplyPlanningScenarios({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canApplyPlanningScenarios({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-beta"
      })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("allows Phase 7 KPI, signal and action engine access only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const controlReader = createAccessProfile({
      id: "control-reader",
      permissions: ["tenant.kpi_definitions.read", "tenant.control_signals.read"]
    });

    expect(
      canReadKpiDefinitions({
        actor,
        profile: controlReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canReadControlSignals({
        actor,
        profile: controlReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canManageKpiDefinitions({
        actor,
        profile: controlReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canExecuteManagementActions({
        actor,
        profile: controlReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageKpiDefinitions({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageControlSignals({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canExecuteManagementActions({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canManageCorrectiveActions({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-alpha"
      }).allowed
    ).toBe(true);
    expect(
      canReadControlSignals({
        actor,
        profile: adminProfile,
        targetTenantId: "tenant-beta"
      })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("allows Phase 8 control surface access only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const surfaceReader = createAccessProfile({
      id: "surface-reader",
      permissions: ["tenant.control_surfaces.read"]
    });
    const surfacePublisher = createAccessProfile({
      id: "surface-publisher",
      permissions: [
        "tenant.control_surfaces.read",
        "tenant.control_surfaces.manage",
        "tenant.control_surfaces.publish"
      ]
    });

    expect(
      canReadControlSurfaces({
        actor,
        profile: surfaceReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canManageControlSurfaces({
        actor,
        profile: surfaceReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canPublishControlSurfaces({
        actor,
        profile: surfacePublisher,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canReadControlSurfaces({
        actor,
        profile: surfacePublisher,
        targetTenantId: "tenant-beta"
      })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });

  it("allows Phase 9 retrospective and template improvement access only with explicit permissions", () => {
    const actor = createTenantUser({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: adminProfile.id
    });
    const retrospectiveReader = createAccessProfile({
      id: "retrospective-reader",
      permissions: ["tenant.retrospectives.read"]
    });
    const retrospectiveManager = createAccessProfile({
      id: "retrospective-manager",
      permissions: [
        "tenant.retrospectives.read",
        "tenant.retrospectives.manage",
        "tenant.template_improvements.apply"
      ]
    });

    expect(
      canReadRetrospectives({
        actor,
        profile: retrospectiveReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canManageRetrospectives({
        actor,
        profile: retrospectiveReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canApplyTemplateImprovements({
        actor,
        profile: retrospectiveReader,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: false,
      reason: "permission_missing"
    });
    expect(
      canManageRetrospectives({
        actor,
        profile: retrospectiveManager,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canApplyTemplateImprovements({
        actor,
        profile: retrospectiveManager,
        targetTenantId: "tenant-alpha"
      })
    ).toEqual({
      allowed: true,
      reason: "same_tenant_permission_granted"
    });
    expect(
      canReadRetrospectives({
        actor,
        profile: retrospectiveManager,
        targetTenantId: "tenant-beta"
      })
    ).toEqual({
      allowed: false,
      reason: "cross_tenant_denied"
    });
  });
});
