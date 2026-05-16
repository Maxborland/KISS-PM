export const PHASE7_FIXTURE_TIMESTAMP = "2026-05-16T12:00:00.000Z";

export type Phase7KpiDefinitionFixture = {
  id: string;
  formulaId: string;
  thresholdRuleSetId: string;
  criticalRuleId: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  plannedWorkHours: number;
  actualWorkHours: number;
  expectedValue: number;
  expectedSeverity: "none" | "attention" | "warning" | "critical";
};

export type Phase7KpiSignalFixture = {
  id: string;
  evaluationId: string;
  sourceEntityId: string;
  expectedSeverity: "attention" | "warning" | "critical";
  recommendedActionKeys: string[];
};

export type Phase7TenantKpiFixture = {
  tenantId: string;
  adminUserId: string;
  projectManagerUserId: string;
  readOnlyUserId: string;
  definition: Phase7KpiDefinitionFixture;
  draftDefinitionId: string;
  draftFormulaId: string;
  draftThresholdRuleSetId: string;
  signal: Phase7KpiSignalFixture;
  warningSignal: Phase7KpiSignalFixture;
};

export type Phase7FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  tenantA: Phase7TenantKpiFixture;
  tenantB: Phase7TenantKpiFixture;
};

const tenantAFixture: Phase7TenantKpiFixture = {
  tenantId: "tenant-a",
  adminUserId: "tenant-admin-a",
  projectManagerUserId: "project-manager-a",
  readOnlyUserId: "readonly-observer-a",
  definition: {
    id: "kpi-schedule-variance-a",
    formulaId: "formula-schedule-variance-a-v1",
    thresholdRuleSetId: "threshold-schedule-variance-a-v1",
    criticalRuleId: "schedule-variance-critical",
    projectId: "project-alpha-a",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-07",
    plannedWorkHours: 80,
    actualWorkHours: 100,
    expectedValue: -25,
    expectedSeverity: "critical"
  },
  draftDefinitionId: "kpi-api-draft-a",
  draftFormulaId: "formula-api-draft-a",
  draftThresholdRuleSetId: "threshold-api-draft-a",
  signal: {
    id: "signal-kpi-schedule-variance-a",
    evaluationId: "eval-kpi-schedule-variance-a-1",
    sourceEntityId: "project-alpha-a",
    expectedSeverity: "critical",
    recommendedActionKeys: ["create_corrective_action", "escalate"]
  },
  warningSignal: {
    id: "signal-kpi-schedule-variance-a-warning",
    evaluationId: "eval-kpi-schedule-variance-a-warning-1",
    sourceEntityId: "project-warning-a",
    expectedSeverity: "warning",
    recommendedActionKeys: ["request_explanation"]
  }
};

const tenantBFixture: Phase7TenantKpiFixture = {
  tenantId: "tenant-b",
  adminUserId: "tenant-admin-b",
  projectManagerUserId: "tenant-admin-b",
  readOnlyUserId: "user-b",
  definition: {
    id: "kpi-schedule-variance-private-b",
    formulaId: "formula-schedule-variance-private-b-v1",
    thresholdRuleSetId: "threshold-schedule-variance-private-b-v1",
    criticalRuleId: "schedule-variance-critical",
    projectId: "project-private-b",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-07",
    plannedWorkHours: 80,
    actualWorkHours: 100,
    expectedValue: -25,
    expectedSeverity: "critical"
  },
  draftDefinitionId: "kpi-private-draft-b",
  draftFormulaId: "formula-private-draft-b",
  draftThresholdRuleSetId: "threshold-private-draft-b",
  signal: {
    id: "signal-kpi-private-b",
    evaluationId: "eval-kpi-private-b-1",
    sourceEntityId: "project-private-b",
    expectedSeverity: "critical",
    recommendedActionKeys: ["create_corrective_action", "escalate"]
  },
  warningSignal: {
    id: "signal-kpi-private-b-warning",
    evaluationId: "eval-kpi-private-b-warning-1",
    sourceEntityId: "project-private-warning-b",
    expectedSeverity: "warning",
    recommendedActionKeys: ["request_explanation"]
  }
};

function cloneTenantFixture(fixture: Phase7TenantKpiFixture): Phase7TenantKpiFixture {
  return {
    ...fixture,
    definition: { ...fixture.definition },
    signal: {
      ...fixture.signal,
      recommendedActionKeys: [...fixture.signal.recommendedActionKeys]
    },
    warningSignal: {
      ...fixture.warningSignal,
      recommendedActionKeys: [...fixture.warningSignal.recommendedActionKeys]
    }
  };
}

export function getPhase7FixtureSeed(): Phase7FixtureSeed {
  return {
    generatedAt: PHASE7_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-060", "E2E-061", "E2E-062", "E2E-063", "E2E-064"],
    tenantA: cloneTenantFixture(tenantAFixture),
    tenantB: cloneTenantFixture(tenantBFixture)
  };
}
