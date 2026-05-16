export const PHASE5_FIXTURE_TIMESTAMP = "2026-05-16T02:00:00.000Z";

export type Phase5FixtureTask = {
  id: string;
  stageKey: "initiation" | "delivery";
  taskTemplateId: string;
  taskTemplateKey: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  plannedWorkHours: number;
  progressPercent: number;
};

export type Phase5FixtureDependency = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: "finish_to_start";
};

export type Phase5TenantScheduleFixture = {
  tenantId: string;
  projectId: string;
  projectDraftId: string;
  seedOpportunityId: string;
  baselineId: string;
  tasks: Phase5FixtureTask[];
  validDependency: Phase5FixtureDependency;
  invalidConflictDependency: Phase5FixtureDependency;
  liveDrift: {
    taskId: string;
    plannedStartDate: string;
    plannedFinishDate: string;
    plannedWorkHours: number;
    progressPercent: number;
  };
};

export type Phase5FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  tenantA: Phase5TenantScheduleFixture;
  tenantB: Phase5TenantScheduleFixture;
};

const tenantAFixture: Phase5TenantScheduleFixture = {
  tenantId: "tenant-a",
  projectId: "project-phase4-main",
  projectDraftId: "project-draft-opportunity-seed-ready",
  seedOpportunityId: "opportunity-seed-ready",
  baselineId: "baseline-project-phase4-main-draft",
  tasks: [
    {
      id: "task-phase5-e2e-kickoff",
      stageKey: "initiation",
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-03",
      plannedWorkHours: 12,
      progressPercent: 20
    },
    {
      id: "task-phase5-e2e-delivery",
      stageKey: "delivery",
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-04",
      plannedFinishDate: "2026-06-08",
      plannedWorkHours: 24,
      progressPercent: 0
    },
    {
      id: "task-phase5-e2e-review",
      stageKey: "delivery",
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-09",
      plannedFinishDate: "2026-06-10",
      plannedWorkHours: 6,
      progressPercent: 0
    }
  ],
  validDependency: {
    id: "dependency-phase5-e2e-kickoff-delivery",
    predecessorTaskId: "task-phase5-e2e-kickoff",
    successorTaskId: "task-phase5-e2e-delivery",
    type: "finish_to_start"
  },
  invalidConflictDependency: {
    id: "dependency-phase5-e2e-conflict",
    predecessorTaskId: "task-phase5-e2e-review",
    successorTaskId: "task-phase5-e2e-delivery",
    type: "finish_to_start"
  },
  liveDrift: {
    taskId: "task-phase5-e2e-kickoff",
    plannedStartDate: "2026-06-05",
    plannedFinishDate: "2026-06-06",
    plannedWorkHours: 10,
    progressPercent: 50
  }
};

const tenantBFixture: Phase5TenantScheduleFixture = {
  tenantId: "tenant-b",
  projectId: "project-phase5-tenant-b-private",
  projectDraftId: "project-draft-opportunity-b-private",
  seedOpportunityId: "opportunity-b-private",
  baselineId: "baseline-project-phase5-tenant-b-private-draft",
  tasks: [
    {
      id: "task-phase5-tenant-b-private",
      stageKey: "initiation",
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      plannedStartDate: "2026-06-11",
      plannedFinishDate: "2026-06-12",
      plannedWorkHours: 8,
      progressPercent: 10
    },
    {
      id: "task-phase5-tenant-b-private-followup",
      stageKey: "delivery",
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      plannedStartDate: "2026-06-13",
      plannedFinishDate: "2026-06-14",
      plannedWorkHours: 8,
      progressPercent: 0
    }
  ],
  validDependency: {
    id: "dependency-phase5-tenant-b-private",
    predecessorTaskId: "task-phase5-tenant-b-private",
    successorTaskId: "task-phase5-tenant-b-private-followup",
    type: "finish_to_start"
  },
  invalidConflictDependency: {
    id: "dependency-phase5-tenant-b-conflict",
    predecessorTaskId: "task-phase5-tenant-b-private",
    successorTaskId: "task-phase5-tenant-b-private",
    type: "finish_to_start"
  },
  liveDrift: {
    taskId: "task-phase5-tenant-b-private",
    plannedStartDate: "2026-06-13",
    plannedFinishDate: "2026-06-14",
    plannedWorkHours: 8,
    progressPercent: 25
  }
};

function cloneTenantFixture(fixture: Phase5TenantScheduleFixture): Phase5TenantScheduleFixture {
  return {
    ...fixture,
    tasks: fixture.tasks.map((task) => ({ ...task })),
    validDependency: { ...fixture.validDependency },
    invalidConflictDependency: { ...fixture.invalidConflictDependency },
    liveDrift: { ...fixture.liveDrift }
  };
}

export function getPhase5FixtureSeed(): Phase5FixtureSeed {
  return {
    generatedAt: PHASE5_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-040", "E2E-041", "E2E-042", "E2E-043", "E2E-044"],
    tenantA: cloneTenantFixture(tenantAFixture),
    tenantB: cloneTenantFixture(tenantBFixture)
  };
}
