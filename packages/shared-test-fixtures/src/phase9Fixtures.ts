export const PHASE9_FIXTURE_TIMESTAMP = "2026-05-17T01:42:00.000Z";

export type Phase9LessonFixture = {
  id: string;
  categoryKey: string;
  summary: string;
  recommendation?: string;
  severity: "positive" | "attention" | "critical";
};

export type Phase9ClosureDataFixture = {
  finalKpiSummary: string;
  qualityScore: number;
  clientSatisfactionScore: number;
  closingSummary: string;
  lessonsLearned: Phase9LessonFixture[];
};

export type Phase9TenantRetrospectiveFixture = {
  tenantId: string;
  projectManagerUserId: string;
  adminUserId: string;
  readOnlyUserId: string;
  closureProjectId: string;
  snapshotProjectIds: string[];
  privateProjectId: string;
  templateImprovementKey: "add_acceptance_checkpoint";
  closureData: Phase9ClosureDataFixture;
};

export type Phase9FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  tenantA: Phase9TenantRetrospectiveFixture;
  tenantB: Phase9TenantRetrospectiveFixture;
};

const tenantA: Phase9TenantRetrospectiveFixture = {
  tenantId: "tenant-a",
  projectManagerUserId: "project-manager-a",
  adminUserId: "tenant-admin-a",
  readOnlyUserId: "readonly-observer-a",
  closureProjectId: "project-phase9-e2e-close-a",
  snapshotProjectIds: ["project-phase9-e2e-snapshot-a", "project-phase9-e2e-snapshot-b"],
  privateProjectId: "project-phase9-private-a",
  templateImprovementKey: "add_acceptance_checkpoint",
  closureData: {
    finalKpiSummary: "Проект закрыт в рамках допустимых KPI.",
    qualityScore: 5,
    clientSatisfactionScore: 4,
    closingSummary: "Поставка завершена, документы и уроки зафиксированы.",
    lessonsLearned: [
      {
        id: "lesson-phase9-e2e-acceptance",
        categoryKey: "process",
        summary: "Поздний старт приемки повторяется в закрытых проектах.",
        recommendation: "Добавить раннюю приемку в будущий шаблон.",
        severity: "attention"
      }
    ]
  }
};

const tenantB: Phase9TenantRetrospectiveFixture = {
  tenantId: "tenant-b",
  projectManagerUserId: "tenant-admin-b",
  adminUserId: "tenant-admin-b",
  readOnlyUserId: "user-b",
  closureProjectId: "project-phase9-private-b-close",
  snapshotProjectIds: ["project-phase9-private-b-snapshot-a", "project-phase9-private-b-snapshot-b"],
  privateProjectId: "project-phase9-private-b",
  templateImprovementKey: "add_acceptance_checkpoint",
  closureData: {
    finalKpiSummary: "Private Tenant B closure KPI summary.",
    qualityScore: 4,
    clientSatisfactionScore: 4,
    closingSummary: "Tenant B private closure data.",
    lessonsLearned: [
      {
        id: "lesson-phase9-private-b",
        categoryKey: "process",
        summary: "Tenant B private lesson.",
        severity: "attention"
      }
    ]
  }
};

function cloneTenant(input: Phase9TenantRetrospectiveFixture): Phase9TenantRetrospectiveFixture {
  return {
    ...input,
    snapshotProjectIds: [...input.snapshotProjectIds],
    closureData: {
      ...input.closureData,
      lessonsLearned: input.closureData.lessonsLearned.map((lesson) => ({ ...lesson }))
    }
  };
}

export function getPhase9FixtureSeed(): Phase9FixtureSeed {
  return {
    generatedAt: PHASE9_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-080", "E2E-081", "E2E-082", "E2E-083"],
    tenantA: cloneTenant(tenantA),
    tenantB: cloneTenant(tenantB)
  };
}
