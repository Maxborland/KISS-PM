export const PHASE10_FIXTURE_TIMESTAMP = "2026-05-17T05:16:00.000Z";

export type Phase10LabelChangesFixture = {
  roleProjectManager: string;
  stageInitiation: string;
};

export type Phase10CustomFieldFixture = {
  projectId: string;
  key: string;
  label: string;
  options: string[];
  value: string;
};

export type Phase10KpiThresholdRuleFixture = {
  id: string;
  severity: "warning" | "critical";
  condition: { operator: "lte"; value: number };
  explanation: string;
  recommendedActionKeys: string[];
};

export type Phase10KpiThresholdFixture = {
  definitionId: string;
  sampleValue: number;
  futureEvaluationProjectId: string;
  rules: Phase10KpiThresholdRuleFixture[];
};

export type Phase10SavedViewFixture = {
  surfaceId: string;
  viewLabel: string;
  savedViewId: string;
  savedViewKey: string;
  savedViewLabel: string;
  visibleFieldKeys: string[];
};

export type Phase10ActionConfigFixture = {
  disabledActionKey: string;
  actionDefinitionId: string;
  targetRowId: string;
  targetSignalId: string;
  reasonDefault: string;
};

export type Phase10TenantCustomizationFixture = {
  tenantId: string;
  adminUserId: string;
  readOnlyUserId: string;
  runtimeUserId: string;
  labelChanges: Phase10LabelChangesFixture;
  customField: Phase10CustomFieldFixture;
  kpiThreshold: Phase10KpiThresholdFixture;
  savedView: Phase10SavedViewFixture;
  actionConfig: Phase10ActionConfigFixture;
  importedRoleLabel: string;
};

export type Phase10FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  tenantA: Phase10TenantCustomizationFixture;
  tenantB: Phase10TenantCustomizationFixture;
};

const tenantA: Phase10TenantCustomizationFixture = {
  tenantId: "tenant-a",
  adminUserId: "tenant-admin-a",
  readOnlyUserId: "readonly-observer-a",
  runtimeUserId: "project-manager-a",
  labelChanges: {
    roleProjectManager: "РП P10",
    stageInitiation: "Старт P10"
  },
  customField: {
    projectId: "project-p10-custom-field",
    key: "risk_level",
    label: "Уровень риска",
    options: ["low", "medium", "high"],
    value: "high"
  },
  kpiThreshold: {
    definitionId: "kpi-schedule-variance-a",
    sampleValue: -25,
    futureEvaluationProjectId: "project-alpha-a",
    rules: [
      {
        id: "schedule-variance-critical",
        severity: "critical",
        condition: { operator: "lte", value: -30 },
        explanation: "Критическое отклонение после настройки P10",
        recommendedActionKeys: ["create_corrective_action", "escalate"]
      },
      {
        id: "schedule-variance-warning",
        severity: "warning",
        condition: { operator: "lte", value: -10 },
        explanation: "Предупреждение после настройки P10",
        recommendedActionKeys: ["request_explanation"]
      }
    ]
  },
  savedView: {
    surfaceId: "portfolio-control",
    viewLabel: "Портфель без технических полей",
    savedViewId: "saved-view-critical-portfolio",
    savedViewKey: "critical_portfolio",
    savedViewLabel: "Критичный портфель",
    visibleFieldKeys: ["project_label", "signal_label", "severity"]
  },
  actionConfig: {
    disabledActionKey: "accept_risk",
    actionDefinitionId: "action-accept-risk",
    targetRowId: "row-kpi-signal-kpi-schedule-variance-a",
    targetSignalId: "signal-kpi-schedule-variance-a",
    reasonDefault: "Риск принят до комитета"
  },
  importedRoleLabel: "РП импорт E2E"
};

const tenantB: Phase10TenantCustomizationFixture = {
  tenantId: "tenant-b",
  adminUserId: "tenant-admin-b",
  readOnlyUserId: "user-b",
  runtimeUserId: "tenant-admin-b",
  labelChanges: {
    roleProjectManager: "Tenant B PM",
    stageInitiation: "Tenant B Start"
  },
  customField: {
    projectId: "project-p10-private-b",
    key: "risk_level_b",
    label: "Tenant B Risk",
    options: ["private"],
    value: "private"
  },
  kpiThreshold: {
    definitionId: "kpi-private-b",
    sampleValue: -10,
    futureEvaluationProjectId: "project-private-b",
    rules: [
      {
        id: "tenant-b-private-rule",
        severity: "warning",
        condition: { operator: "lte", value: -10 },
        explanation: "Tenant B private KPI rule",
        recommendedActionKeys: ["request_explanation"]
      }
    ]
  },
  savedView: {
    surfaceId: "portfolio-control",
    viewLabel: "Tenant B private layout",
    savedViewId: "saved-view-private-b",
    savedViewKey: "private_b",
    savedViewLabel: "Tenant B private view",
    visibleFieldKeys: ["project_label"]
  },
  actionConfig: {
    disabledActionKey: "accept_risk",
    actionDefinitionId: "action-accept-risk",
    targetRowId: "row-tenant-b-private",
    targetSignalId: "signal-tenant-b-private",
    reasonDefault: "Tenant B private reason"
  },
  importedRoleLabel: "Tenant B Imported PM"
};

function cloneTenant(input: Phase10TenantCustomizationFixture): Phase10TenantCustomizationFixture {
  return {
    ...input,
    labelChanges: { ...input.labelChanges },
    customField: { ...input.customField, options: [...input.customField.options] },
    kpiThreshold: {
      ...input.kpiThreshold,
      rules: input.kpiThreshold.rules.map((rule) => ({
        ...rule,
        condition: { ...rule.condition },
        recommendedActionKeys: [...rule.recommendedActionKeys]
      }))
    },
    savedView: { ...input.savedView, visibleFieldKeys: [...input.savedView.visibleFieldKeys] },
    actionConfig: { ...input.actionConfig }
  };
}

export function getPhase10FixtureSeed(): Phase10FixtureSeed {
  return {
    generatedAt: PHASE10_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"],
    tenantA: cloneTenant(tenantA),
    tenantB: cloneTenant(tenantB)
  };
}
