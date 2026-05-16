import { describe, expect, it } from "vitest";

import {
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  createTaskFromStageTaskTemplate,
  listProjectTasks
} from "@kiss-pm/project-core";

import { SchedulingEngineModelError, createWbsProjectionFromProject } from "./index";

const tenantId = "tenant-a";
const projectId = "project-alpha";

function makeProject() {
  return {
    id: projectId,
    tenantId,
    stages: [
      {
        id: "stage-delivery",
        tenantId,
        projectId,
        sortOrder: 20,
        label: "Delivery"
      },
      {
        id: "stage-initiation",
        tenantId,
        projectId,
        sortOrder: 10,
        label: "Initiation"
      }
    ],
    tasks: [
      {
        id: "task-delivery-review",
        tenantId,
        projectId,
        stageId: "stage-delivery",
        title: "Delivery review",
        dueDate: "2026-06-20",
        plannedWorkHours: 8
      },
      {
        id: "task-kickoff",
        tenantId,
        projectId,
        stageId: "stage-initiation",
        title: "Kickoff",
        dueDate: "2026-06-05",
        plannedWorkHours: 12
      }
    ]
  };
}

function makeProjectCoreDraft() {
  return createProjectDraftFromOpportunity({
    id: "project-draft-1",
    tenantId,
    title: "Внедрение портала АКМЕ",
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-14T21:10:00.000Z",
    correlationId: "corr-project-draft-opportunity-seed-ready",
    sourceOpportunity: {
      tenantId,
      type: "crm_opportunity",
      opportunityId: "opportunity-seed-ready",
      title: "Внедрение портала АКМЕ",
      accountId: "account-opportunity-seed-ready",
      contactIds: ["contact-opportunity-seed-ready"],
      plannedStartDate: "2026-06-01",
      desiredFinishDate: "2026-06-30"
    },
    processTemplate: {
      tenantId,
      templateId: "process-template-tenant-a-implementation",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      version: 3,
      matchConfidence: 0.9,
      assumptions: []
    },
    demand: {
      tenantId,
      totalPlannedWorkHours: 64,
      scenarioKey: "baseline",
      scenarioLabel: "Базовый сценарий",
      formulaKey: "phase3.template_scope_linear",
      formulaVersion: 1,
      confidence: 0.84,
      stageRoleDemands: []
    },
    feasibility: {
      tenantId,
      status: "fit",
      severity: "warning",
      expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
      blockerCodes: []
    }
  });
}

function makeProjectCoreProcessTemplate() {
  return createProcessTemplate({
    id: "process-template-tenant-a-implementation",
    tenantId,
    key: "implementation.standard",
    label: "Стандартное внедрение",
    active: true,
    version: 3,
    updatedAt: "2026-05-15T05:55:00+07:00",
    stages: [
      {
        id: "stage-initiation",
        tenantId,
        key: "initiation",
        label: "Инициация",
        sortOrder: 10,
        active: true,
        version: 4,
        updatedAt: "2026-05-15T05:54:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: [
          {
            id: "task-template-kickoff",
            tenantId,
            key: "kickoff",
            label: "Провести старт проекта",
            defaultParticipantRoleKeys: ["executor", "controller"],
            required: true
          }
        ]
      },
      {
        id: "stage-delivery",
        tenantId,
        key: "delivery",
        label: "Исполнение",
        sortOrder: 20,
        active: true,
        version: 2,
        updatedAt: "2026-05-15T05:53:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: [
          {
            id: "task-template-delivery",
            tenantId,
            key: "delivery_work",
            label: "Выполнить поставку",
            defaultParticipantRoleKeys: ["executor"],
            required: true
          }
        ]
      }
    ]
  });
}

function makeProjectCoreProjectWithTasks() {
  const project = createManagedProjectFromDraft({
    id: "project-managed-1",
    draft: makeProjectCoreDraft(),
    processTemplate: makeProjectCoreProcessTemplate(),
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-15T05:56:00+07:00",
    correlationId: "corr-managed-project-1"
  });
  const withKickoff = createTaskFromStageTaskTemplate(project, {
    id: "task-1",
    tenantId,
    stageId: "project-managed-1:stage-initiation",
    taskTemplateId: "task-template-kickoff",
    taskTemplateKey: "kickoff",
    dueDate: "2026-06-05",
    plannedWorkHours: 12,
    actorId: "user-project-manager-a",
    createdAt: "2026-05-15T05:57:00+07:00",
    correlationId: "corr-task-1"
  });

  return createTaskFromStageTaskTemplate(withKickoff, {
    id: "task-2",
    tenantId,
    stageId: "project-managed-1:stage-delivery",
    taskTemplateId: "task-template-delivery",
    taskTemplateKey: "delivery_work",
    dueDate: "2026-06-20",
    plannedWorkHours: 24,
    actorId: "user-project-manager-a",
    createdAt: "2026-05-15T05:58:00+07:00",
    correlationId: "corr-task-2"
  });
}

describe("WBS projection from canonical project data", () => {
  it("creates WBS nodes that reference canonical project stages and tasks", () => {
    const projection = createWbsProjectionFromProject({
      id: "schedule-plan-alpha",
      project: makeProject(),
      version: 1
    });

    expect(projection).toMatchObject({
      id: "schedule-plan-alpha",
      tenantId,
      projectId,
      status: "draft",
      source: {
        type: "canonical_project",
        projectId
      }
    });
    expect(projection.wbsNodes.map((node) => node.id)).toEqual([
      "wbs-stage-stage-initiation",
      "wbs-task-task-kickoff",
      "wbs-stage-stage-delivery",
      "wbs-task-task-delivery-review"
    ]);
    expect(projection.wbsNodes[0]).toMatchObject({
      stageId: "stage-initiation",
      sortOrder: 10
    });
    expect(projection.wbsNodes[1]).toMatchObject({
      parentId: "wbs-stage-stage-initiation",
      taskId: "task-kickoff",
      sortOrder: 20,
      schedule: {
        plannedFinishDate: "2026-06-05"
      },
      plannedWorkHours: 12
    });
    expect(Object.keys(projection.wbsNodes[1] ?? {})).not.toContain("ganttTaskId");
  });

  it("keeps projection order stable when input stages and tasks are shuffled", () => {
    const project = makeProject();
    const baseProjection = createWbsProjectionFromProject({ id: "plan-a", project, version: 1 });
    const shuffledProjection = createWbsProjectionFromProject({
      id: "plan-b",
      project: {
        ...project,
        stages: [...project.stages].reverse(),
        tasks: [...project.tasks].reverse()
      },
      version: 1
    });

    expect(shuffledProjection.wbsNodes.map((node) => node.id)).toEqual(
      baseProjection.wbsNodes.map((node) => node.id)
    );
  });

  it("keeps canonical task ids compatible with project-core task listings", () => {
    const project = makeProjectCoreProjectWithTasks();
    const projection = createWbsProjectionFromProject({
      id: "schedule-plan-from-project-core",
      project,
      version: 1
    });

    const projectedTaskIds = projection.wbsNodes
      .map((node) => node.taskId)
      .filter((taskId): taskId is string => taskId !== undefined)
      .sort();
    const projectCoreTaskIds = listProjectTasks(project)
      .map((task) => task.id)
      .sort();

    expect(projectedTaskIds).toEqual(projectCoreTaskIds);
    expect(projection.wbsNodes.every((node) => !Object.keys(node).includes("kanbanTaskId"))).toBe(true);
    expect(projection.wbsNodes.every((node) => !Object.keys(node).includes("ganttTaskId"))).toBe(true);
  });

  it("rejects cross-tenant and cross-project stage or task references", () => {
    expect(() =>
      createWbsProjectionFromProject({
        id: "plan-cross-tenant-stage",
        project: {
          ...makeProject(),
          stages: [{ ...makeProject().stages[0]!, tenantId: "tenant-b" }]
        },
        version: 1
      })
    ).toThrow("project stage tenant mismatch");

    expect(() =>
      createWbsProjectionFromProject({
        id: "plan-cross-project-task",
        project: {
          ...makeProject(),
          tasks: [{ ...makeProject().tasks[0]!, projectId: "project-beta" }]
        },
        version: 1
      })
    ).toThrow("project task project mismatch");
  });

  it("rejects duplicate canonical ids and tasks pointing to unknown stages", () => {
    expect(() =>
      createWbsProjectionFromProject({
        id: "plan-duplicate-stage",
        project: {
          ...makeProject(),
          stages: [makeProject().stages[0]!, { ...makeProject().stages[1]!, id: makeProject().stages[0]!.id }]
        },
        version: 1
      })
    ).toThrow("canonical project stage ids must be unique");

    expect(() =>
      createWbsProjectionFromProject({
        id: "plan-duplicate-task",
        project: {
          ...makeProject(),
          tasks: [makeProject().tasks[0]!, { ...makeProject().tasks[1]!, id: makeProject().tasks[0]!.id }]
        },
        version: 1
      })
    ).toThrow("canonical project task ids must be unique");

    expect(() =>
      createWbsProjectionFromProject({
        id: "plan-unknown-stage",
        project: {
          ...makeProject(),
          tasks: [{ ...makeProject().tasks[0]!, stageId: "stage-missing" }]
        },
        version: 1
      })
    ).toThrow("project task stageId must reference a project stage");

    expect(() =>
      createWbsProjectionFromProject({
        id: "plan-invalid",
        project: {
          ...makeProject(),
          stages: [{ ...makeProject().stages[0]!, sortOrder: 0 }]
        },
        version: 1
      })
    ).toThrow(SchedulingEngineModelError);
  });
});
