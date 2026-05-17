export const PHASE12_FIXTURE_TIMESTAMP = "2026-05-17T09:58:00.000Z";

export type Phase12RoleFixture = {
  systemKey:
    | "operator_admin"
    | "tenant_admin"
    | "project_manager"
    | "resource_manager"
    | "executive"
    | "executor"
    | "integration_admin"
    | "readonly_observer";
  userId: string;
  accessProfileId: string;
  label: string;
};

export type Phase12TemplatePackFixture = {
  processTemplateKey: "release_demo_control_loop";
  stageTemplates: string[];
  roleTemplates: Phase12RoleFixture[];
  kpiDefinitionIds: string[];
  thresholdRuleSetIds: string[];
  controlSurfaceKeys: string[];
  actionKeys: string[];
  customFieldKeys: string[];
  savedViewKeys: string[];
};

export type Phase12CriticalJourneyFixture = {
  opportunityId: string;
  projectDraftId: string;
  activeProjectId: string;
  closureProjectId: string;
  resourceOverloadId: string;
  kpiSignalId: string;
  retrospectiveInsightId: string;
  integrationBatchId: string;
};

export type Phase12MockExternalServicesFixture = {
  mode: "mocked";
  adapterId: string;
  connectionId: string;
  payloadFixtureKey: string;
  noLiveServiceProof: string;
};

export type Phase12TenantAReleaseDemoFixture = {
  tenantId: "tenant-a";
  roles: {
    operatorAdmin: Phase12RoleFixture;
    tenantAdmin: Phase12RoleFixture;
    projectManager: Phase12RoleFixture;
    resourceManager: Phase12RoleFixture;
    executive: Phase12RoleFixture;
    executor: Phase12RoleFixture;
    integrationAdmin: Phase12RoleFixture;
    readonlyObserver: Phase12RoleFixture;
  };
  templatePack: Phase12TemplatePackFixture;
  criticalJourney: Phase12CriticalJourneyFixture;
  mockExternalServices: Phase12MockExternalServicesFixture;
  opsSeed: {
    releaseReadinessRunId: string;
    permissionSmokeRunId: string;
    tenantIsolationRunId: string;
    recoveryRunId: string;
  };
};

export type Phase12TenantBIsolationFixture = {
  tenantId: "tenant-b";
  operatorDocsAudience: "isolation-check-only";
  privateEntities: string[];
};

export type Phase12FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  e2ePaths: string[];
  operatorDocs: string[];
  tenantA: Phase12TenantAReleaseDemoFixture;
  tenantB: Phase12TenantBIsolationFixture;
};

const tenantAdminRole: Phase12RoleFixture = {
  systemKey: "tenant_admin",
  userId: "tenant-admin-a",
  accessProfileId: "profile-tenant-admin-a",
  label: "Администратор тенанта"
};

const roleTemplates: Phase12RoleFixture[] = [
  {
    systemKey: "operator_admin",
    userId: "tenant-admin-a",
    accessProfileId: "profile-tenant-admin-a",
    label: "Оператор релиза"
  },
  tenantAdminRole,
  {
    systemKey: "project_manager",
    userId: "project-manager-a",
    accessProfileId: "profile-project-manager-a",
    label: "Руководитель проекта"
  },
  {
    systemKey: "resource_manager",
    userId: "resource-manager-a",
    accessProfileId: "profile-resource-manager-a",
    label: "Ресурсный менеджер"
  },
  {
    systemKey: "executive",
    userId: "tenant-admin-a",
    accessProfileId: "profile-tenant-admin-a",
    label: "Руководитель портфеля"
  },
  {
    systemKey: "executor",
    userId: "executor-a",
    accessProfileId: "profile-executor-a",
    label: "Исполнитель"
  },
  {
    systemKey: "integration_admin",
    userId: "tenant-admin-a",
    accessProfileId: "profile-tenant-admin-a",
    label: "Администратор интеграций"
  },
  {
    systemKey: "readonly_observer",
    userId: "readonly-observer-a",
    accessProfileId: "profile-readonly-observer-a",
    label: "Наблюдатель"
  }
];

const tenantA: Phase12TenantAReleaseDemoFixture = {
  tenantId: "tenant-a",
  roles: {
    operatorAdmin: roleTemplates[0],
    tenantAdmin: tenantAdminRole,
    projectManager: roleTemplates[2],
    resourceManager: roleTemplates[3],
    executive: roleTemplates[4],
    executor: roleTemplates[5],
    integrationAdmin: roleTemplates[6],
    readonlyObserver: roleTemplates[7]
  },
  templatePack: {
    processTemplateKey: "release_demo_control_loop",
    stageTemplates: ["intake", "planning", "execution", "control", "closure", "retrospective"],
    roleTemplates,
    kpiDefinitionIds: ["kpi-schedule-variance-a", "kpi-budget-variance-a"],
    thresholdRuleSetIds: ["threshold-schedule-variance-a", "threshold-budget-variance-a"],
    controlSurfaceKeys: [
      "crm-intake",
      "project-work",
      "gantt-workspace",
      "resource-load-control",
      "kpi-deviation-control",
      "portfolio-control",
      "closed-portfolio-retrospectives",
      "integration-admin-diagnostics",
      "operator-readiness"
    ],
    actionKeys: ["create_project_draft", "schedule.baseline.capture", "resource_resolution.apply", "control.action.execute"],
    customFieldKeys: ["risk_level", "release_readiness_owner"],
    savedViewKeys: ["critical_portfolio", "operator_readiness"]
  },
  criticalJourney: {
    opportunityId: "opp-release-demo-a",
    projectDraftId: "draft-release-demo-a",
    activeProjectId: "project-release-demo-a",
    closureProjectId: "project-p9-closure",
    resourceOverloadId: "overload-main-a",
    kpiSignalId: "signal-kpi-schedule-variance-a",
    retrospectiveInsightId: "insight-template-repeat-delay",
    integrationBatchId: "batch-e2e-100-p11"
  },
  mockExternalServices: {
    mode: "mocked",
    adapterId: "adapter-mock-crm",
    connectionId: "conn-mock-crm-a",
    payloadFixtureKey: "mock-crm-valid",
    noLiveServiceProof: "KISS_PM_EXTERNAL_SERVICES_MODE=mocked"
  },
  opsSeed: {
    releaseReadinessRunId: "p12-readiness-tenant-a-0001",
    permissionSmokeRunId: "p12-permission-smoke-tenant-a-0001",
    tenantIsolationRunId: "p12-tenant-isolation-smoke-tenant-a-0001",
    recoveryRunId: "p12-recovery-tenant-a-0001"
  }
};

const tenantB: Phase12TenantBIsolationFixture = {
  tenantId: "tenant-b",
  operatorDocsAudience: "isolation-check-only",
  privateEntities: ["opp-private-b", "project-private-b", "kpi-private-b", "mapping-private-b"]
};

function cloneRole(role: Phase12RoleFixture): Phase12RoleFixture {
  return { ...role };
}

function cloneTenantA(): Phase12TenantAReleaseDemoFixture {
  const roles = {
    operatorAdmin: cloneRole(tenantA.roles.operatorAdmin),
    tenantAdmin: cloneRole(tenantA.roles.tenantAdmin),
    projectManager: cloneRole(tenantA.roles.projectManager),
    resourceManager: cloneRole(tenantA.roles.resourceManager),
    executive: cloneRole(tenantA.roles.executive),
    executor: cloneRole(tenantA.roles.executor),
    integrationAdmin: cloneRole(tenantA.roles.integrationAdmin),
    readonlyObserver: cloneRole(tenantA.roles.readonlyObserver)
  };

  return {
    ...tenantA,
    roles,
    templatePack: {
      ...tenantA.templatePack,
      stageTemplates: [...tenantA.templatePack.stageTemplates],
      roleTemplates: tenantA.templatePack.roleTemplates.map(cloneRole),
      kpiDefinitionIds: [...tenantA.templatePack.kpiDefinitionIds],
      thresholdRuleSetIds: [...tenantA.templatePack.thresholdRuleSetIds],
      controlSurfaceKeys: [...tenantA.templatePack.controlSurfaceKeys],
      actionKeys: [...tenantA.templatePack.actionKeys],
      customFieldKeys: [...tenantA.templatePack.customFieldKeys],
      savedViewKeys: [...tenantA.templatePack.savedViewKeys]
    },
    criticalJourney: { ...tenantA.criticalJourney },
    mockExternalServices: { ...tenantA.mockExternalServices },
    opsSeed: { ...tenantA.opsSeed }
  };
}

export function getPhase12FixtureSeed(): Phase12FixtureSeed {
  return {
    generatedAt: PHASE12_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-110", "E2E-111", "E2E-112", "E2E-113", "E2E-114", "E2E-115"],
    e2ePaths: [
      "e2e/tests/phase12/full-critical-journey.spec.ts",
      "e2e/tests/phase12/permission-matrix-smoke.spec.ts",
      "e2e/tests/phase12/tenant-isolation-full.spec.ts",
      "e2e/tests/phase12/production-deploy-smoke.spec.ts",
      "e2e/tests/phase12/recovery-smoke.spec.ts",
      "e2e/tests/phase12/no-live-external-dependency.spec.ts"
    ],
    operatorDocs: [
      "docs/operations/PHASE_12_RELEASE_DEMO_TENANT_TEMPLATE_PACK.md",
      "docs/operations/PHASE_12_OPERATOR_ONBOARDING.md"
    ],
    tenantA: cloneTenantA(),
    tenantB: {
      ...tenantB,
      privateEntities: [...tenantB.privateEntities]
    }
  };
}
