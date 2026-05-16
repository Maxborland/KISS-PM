export const PHASE8_FIXTURE_TIMESTAMP = "2026-05-16T16:20:00.000Z";

export type Phase8ActionFixture = {
  corrective: string;
  acceptRisk: string;
  escalate: string;
  requestExplanation: string;
  shiftResourceWork: string;
  splitResourceWork: string;
  reassignResource: string;
  acceptResourceOverload: string;
};

export type Phase8TenantControlFixture = {
  tenantId: string;
  surfaceId: string;
  projectManagerUserId: string;
  resourceManagerUserId: string;
  adminUserId: string;
  readOnlyUserId: string;
  projectId: string;
  criticalSignalId: string;
  warningSignalId: string;
  resourceOverloadId: string;
  criticalSignalRowId: string;
  warningSignalRowId: string;
  resourceOverloadRowId: string;
  loadBucketId: string;
  assignmentId: string;
  actions: Phase8ActionFixture;
};

export type Phase8FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  tenantA: Phase8TenantControlFixture;
  tenantB: Phase8TenantControlFixture & {
    privateProjectId: string;
  };
};

const actions: Phase8ActionFixture = {
  corrective: "action-create-corrective-task",
  acceptRisk: "action-accept-risk",
  escalate: "action-escalate-signal",
  requestExplanation: "action-request-explanation",
  shiftResourceWork: "action-shift-resource-work",
  splitResourceWork: "action-split-resource-work",
  reassignResource: "action-reassign-resource",
  acceptResourceOverload: "action-accept-resource-overload"
};

const tenantA: Phase8TenantControlFixture = {
  tenantId: "tenant-a",
  surfaceId: "portfolio-control",
  projectManagerUserId: "project-manager-a",
  resourceManagerUserId: "resource-manager-a",
  adminUserId: "tenant-admin-a",
  readOnlyUserId: "readonly-observer-a",
  projectId: "project-alpha-a",
  criticalSignalId: "signal-kpi-schedule-variance-a",
  warningSignalId: "signal-kpi-schedule-variance-a-warning",
  resourceOverloadId: "overload:resource-architect-a:2026-06-01:2026-06-05",
  criticalSignalRowId: "row-kpi-signal-kpi-schedule-variance-a",
  warningSignalRowId: "row-kpi-signal-kpi-schedule-variance-a-warning",
  resourceOverloadRowId: "row-resource-overload-resource-architect-a",
  loadBucketId: "load:resource-architect-a:2026-06-01:2026-06-05",
  assignmentId: "assignment-design-architect-a",
  actions
};

const tenantB: Phase8FixtureSeed["tenantB"] = {
  tenantId: "tenant-b",
  surfaceId: "portfolio-control",
  projectManagerUserId: "tenant-admin-b",
  resourceManagerUserId: "tenant-admin-b",
  adminUserId: "tenant-admin-b",
  readOnlyUserId: "user-b",
  projectId: "project-private-b",
  privateProjectId: "project-private-b",
  criticalSignalId: "signal-kpi-private-b",
  warningSignalId: "signal-kpi-private-b-warning",
  resourceOverloadId: "overload:resource-private-b:2026-06-01:2026-06-05",
  criticalSignalRowId: "row-kpi-signal-kpi-private-b",
  warningSignalRowId: "row-kpi-signal-kpi-private-b-warning",
  resourceOverloadRowId: "row-resource-overload-resource-private-b",
  loadBucketId: "load:resource-private-b:2026-06-01:2026-06-05",
  assignmentId: "assignment-private-b",
  actions
};

function cloneActions(input: Phase8ActionFixture): Phase8ActionFixture {
  return { ...input };
}

function cloneTenant(input: Phase8TenantControlFixture): Phase8TenantControlFixture {
  return {
    ...input,
    actions: cloneActions(input.actions)
  };
}

export function getPhase8FixtureSeed(): Phase8FixtureSeed {
  return {
    generatedAt: PHASE8_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-070", "E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"],
    tenantA: cloneTenant(tenantA),
    tenantB: {
      ...cloneTenant(tenantB),
      privateProjectId: tenantB.privateProjectId
    }
  };
}
