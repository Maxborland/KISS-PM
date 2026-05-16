export const PHASE6_FIXTURE_TIMESTAMP = "2026-05-16T09:00:00.000+07:00";

export type Phase6ResourceFixture = {
  id: string;
  label: string;
  userId?: string;
  calendarId: string;
};

export type Phase6LoadBucketFixture = {
  id: string;
  resourceProfileId: string;
  periodStart: string;
  periodEnd: string;
  capacityHours: number;
  assignedHours: number;
  reservedHours: number;
  totalLoadHours: number;
  loadPercent: number;
  severity: "none" | "watch" | "warning" | "critical";
};

export type Phase6OverloadFixture = {
  id: string;
  loadBucketId: string;
  resourceProfileId: string;
  assignmentId: string;
  reservationId: string;
  affectedProjectIds: string[];
  affectedTaskIds: string[];
  recommendedActionKeys: string[];
  previewId: string;
};

export type Phase6TenantResourceFixture = {
  tenantId: string;
  readerUserId: string;
  managerUserId: string;
  adminUserId: string;
  resources: Phase6ResourceFixture[];
  loadBucket: Phase6LoadBucketFixture;
  overload?: Phase6OverloadFixture;
};

export type Phase6FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  tenantA: Phase6TenantResourceFixture;
  tenantB: Phase6TenantResourceFixture;
};

const tenantAFixture: Phase6TenantResourceFixture = {
  tenantId: "tenant-a",
  readerUserId: "readonly-observer-a",
  managerUserId: "resource-manager-a",
  adminUserId: "tenant-admin-a",
  resources: [
    {
      id: "resource-architect-a",
      label: "Анна Архитектор",
      userId: "executor-a",
      calendarId: "calendar-architect-a"
    },
    {
      id: "resource-engineer-a",
      label: "Егор Инженер",
      userId: "project-manager-a",
      calendarId: "calendar-engineer-a"
    }
  ],
  loadBucket: {
    id: "load:resource-architect-a:2026-06-01:2026-06-05",
    resourceProfileId: "resource-architect-a",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-05",
    capacityHours: 36,
    assignedHours: 42,
    reservedHours: 8,
    totalLoadHours: 50,
    loadPercent: 138.89,
    severity: "critical"
  },
  overload: {
    id: "overload:resource-architect-a:2026-06-01:2026-06-05",
    loadBucketId: "load:resource-architect-a:2026-06-01:2026-06-05",
    resourceProfileId: "resource-architect-a",
    assignmentId: "assignment-design-architect-a",
    reservationId: "reservation-draft-architect-a",
    affectedProjectIds: ["project-alpha-a", "project-draft-alpha-a"],
    affectedTaskIds: ["task-design-a"],
    recommendedActionKeys: ["shift_work", "split_work", "reassign_resource", "accept_risk"],
    previewId: "preview-resource-1-1"
  }
};

const tenantBFixture: Phase6TenantResourceFixture = {
  tenantId: "tenant-b",
  readerUserId: "tenant-admin-b",
  managerUserId: "tenant-admin-b",
  adminUserId: "tenant-admin-b",
  resources: [
    {
      id: "resource-private-b",
      label: "Tenant B private resource",
      userId: "user-b",
      calendarId: "calendar-private-b"
    }
  ],
  loadBucket: {
    id: "load:resource-private-b:2026-06-01:2026-06-05",
    resourceProfileId: "resource-private-b",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-05",
    capacityHours: 40,
    assignedHours: 8,
    reservedHours: 0,
    totalLoadHours: 8,
    loadPercent: 20,
    severity: "none"
  }
};

function cloneTenantFixture(fixture: Phase6TenantResourceFixture): Phase6TenantResourceFixture {
  return {
    ...fixture,
    resources: fixture.resources.map((resource) => ({ ...resource })),
    loadBucket: { ...fixture.loadBucket },
    ...(fixture.overload !== undefined
      ? {
          overload: {
            ...fixture.overload,
            affectedProjectIds: [...fixture.overload.affectedProjectIds],
            affectedTaskIds: [...fixture.overload.affectedTaskIds],
            recommendedActionKeys: [...fixture.overload.recommendedActionKeys]
          }
        }
      : {})
  };
}

export function getPhase6FixtureSeed(): Phase6FixtureSeed {
  return {
    generatedAt: PHASE6_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"],
    tenantA: cloneTenantFixture(tenantAFixture),
    tenantB: cloneTenantFixture(tenantBFixture)
  };
}
