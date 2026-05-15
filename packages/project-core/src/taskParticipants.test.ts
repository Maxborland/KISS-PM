import { describe, expect, it } from "vitest";

import {
  ProjectCoreModelError,
  addTaskParticipant,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  createTaskFromStageTaskTemplate,
  listTaskParticipants,
  listTasksByParticipant
} from "./index";

const tenantId = "tenant-a";

function makeDraft() {
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
      stageRoleDemands: [
        {
          stageKey: "initiation",
          stageLabel: "Инициация",
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          plannedWorkHours: 64
        }
      ]
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

function makeProcessTemplate() {
  return createProcessTemplate({
    id: "process-template-tenant-a-implementation",
    tenantId,
    key: "implementation.standard",
    label: "Стандартное внедрение",
    active: true,
    version: 3,
    updatedAt: "2026-05-15T07:35:00+07:00",
    stages: [
      {
        id: "stage-initiation",
        tenantId,
        key: "initiation",
        label: "Инициация",
        sortOrder: 10,
        active: true,
        version: 4,
        updatedAt: "2026-05-15T07:34:00+07:00",
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
      }
    ]
  });
}

function makeProjectWithTask() {
  const project = createManagedProjectFromDraft({
    id: "project-managed-1",
    draft: makeDraft(),
    processTemplate: makeProcessTemplate(),
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-15T07:36:00+07:00",
    correlationId: "corr-managed-project-1"
  });

  return createTaskFromStageTaskTemplate(project, {
    id: "task-1",
    tenantId,
    stageId: "project-managed-1:stage-initiation",
    taskTemplateId: "task-template-kickoff",
    taskTemplateKey: "kickoff",
    dueDate: "2026-06-05",
    plannedWorkHours: 12,
    actorId: "user-project-manager-a",
    createdAt: "2026-05-15T07:37:00+07:00",
    correlationId: "corr-task-1"
  });
}

describe("task participants and assignment roles", () => {
  it("adds tenant-owned role assignments without changing canonical task identity", () => {
    const project = makeProjectWithTask();
    const nextProject = addTaskParticipant(project, {
      id: "participant-task-1-executor",
      tenantId,
      taskId: "task-1",
      userId: "executor-a",
      role: "executor",
      addedBy: "user-project-manager-a",
      addedAt: "2026-05-15T07:38:00+07:00",
      correlationId: "corr-participant-1"
    });

    expect(project.taskParticipants).toEqual([]);
    expect(nextProject.tasks.map((task) => task.id)).toEqual(["task-1"]);
    expect(nextProject.taskParticipants).toEqual([
      {
        id: "participant-task-1-executor",
        tenantId,
        projectId: "project-managed-1",
        stageId: "project-managed-1:stage-initiation",
        taskId: "task-1",
        userId: "executor-a",
        role: "executor",
        addedBy: "user-project-manager-a",
        addedAt: "2026-05-15T07:38:00+07:00",
        correlationId: "corr-participant-1"
      }
    ]);
  });

  it("supports all Phase 4 participant roles and queries by relation", () => {
    const roles = ["executor", "co_executor", "requester", "controller", "approver", "observer"] as const;
    const project = roles.reduce(
      (currentProject, role, index) =>
        addTaskParticipant(currentProject, {
          id: `participant-${role}`,
          tenantId,
          taskId: "task-1",
          userId: index < 2 ? "executor-a" : `user-${role}`,
          role,
          addedBy: "user-project-manager-a",
          addedAt: `2026-05-15T07:38:0${index}+07:00`,
          correlationId: `corr-participant-${role}`
        }),
      makeProjectWithTask()
    );

    expect(listTaskParticipants(project, { tenantId }).map((participant) => participant.role)).toEqual([...roles]);
    expect(
      listTaskParticipants(project, {
        tenantId,
        userId: "executor-a",
        roles: ["executor", "co_executor"]
      }).map((participant) => participant.role)
    ).toEqual(["executor", "co_executor"]);
    expect(listTasksByParticipant(project, { tenantId, userId: "executor-a" }).map((task) => task.id)).toEqual([
      "task-1"
    ]);
  });

  it("deduplicates per task, role, and user while allowing different roles for the same user", () => {
    const project = addTaskParticipant(makeProjectWithTask(), {
      id: "participant-task-1-executor",
      tenantId,
      taskId: "task-1",
      userId: "executor-a",
      role: "executor",
      addedBy: "user-project-manager-a",
      addedAt: "2026-05-15T07:38:00+07:00",
      correlationId: "corr-participant-1"
    });

    expect(() =>
      addTaskParticipant(project, {
        id: "participant-task-1-executor-duplicate",
        tenantId,
        taskId: "task-1",
        userId: "executor-a",
        role: "executor",
        addedBy: "user-project-manager-a",
        addedAt: "2026-05-15T07:39:00+07:00",
        correlationId: "corr-participant-duplicate"
      })
    ).toThrow("task participant assignment must be unique per task, role, and user");

    expect(
      addTaskParticipant(project, {
        id: "participant-task-1-controller",
        tenantId,
        taskId: "task-1",
        userId: "executor-a",
        role: "controller",
        addedBy: "user-project-manager-a",
        addedAt: "2026-05-15T07:39:00+07:00",
        correlationId: "corr-participant-controller"
      }).taskParticipants.map((participant) => participant.role)
    ).toEqual(["executor", "controller"]);
  });

  it("rejects tenant mismatches, unknown tasks, invalid roles, and stale timestamps", () => {
    expect(() =>
      addTaskParticipant(makeProjectWithTask(), {
        id: "participant-wrong-tenant",
        tenantId: "tenant-b",
        taskId: "task-1",
        userId: "executor-a",
        role: "executor",
        addedBy: "user-project-manager-a",
        addedAt: "2026-05-15T07:38:00+07:00",
        correlationId: "corr-wrong-tenant"
      })
    ).toThrow("taskParticipant tenant mismatch");

    expect(() =>
      addTaskParticipant(makeProjectWithTask(), {
        id: "participant-missing-task",
        tenantId,
        taskId: "task-missing",
        userId: "executor-a",
        role: "executor",
        addedBy: "user-project-manager-a",
        addedAt: "2026-05-15T07:38:00+07:00",
        correlationId: "corr-missing-task"
      })
    ).toThrow("task not found");

    expect(() =>
      addTaskParticipant(makeProjectWithTask(), {
        id: "participant-invalid-role",
        tenantId,
        taskId: "task-1",
        userId: "executor-a",
        role: "assignee" as never,
        addedBy: "user-project-manager-a",
        addedAt: "2026-05-15T07:38:00+07:00",
        correlationId: "corr-invalid-role"
      })
    ).toThrow("taskParticipant.role is invalid");

    expect(() =>
      addTaskParticipant(makeProjectWithTask(), {
        id: "participant-stale",
        tenantId,
        taskId: "task-1",
        userId: "executor-a",
        role: "executor",
        addedBy: "user-project-manager-a",
        addedAt: "2026-05-15T07:36:59+07:00",
        correlationId: "corr-stale"
      })
    ).toThrow(ProjectCoreModelError);
  });

  it("rejects malformed persisted participant rows before relation queries", () => {
    const project = addTaskParticipant(makeProjectWithTask(), {
      id: "participant-task-1-executor",
      tenantId,
      taskId: "task-1",
      userId: "executor-a",
      role: "executor",
      addedBy: "user-project-manager-a",
      addedAt: "2026-05-15T07:38:00+07:00",
      correlationId: "corr-participant-1"
    });

    expect(() =>
      listTaskParticipants({
        ...project,
        taskParticipants: [{ ...project.taskParticipants[0]!, taskId: "task-missing" }]
      })
    ).toThrow("managedProject task participant task mismatch");

    expect(() =>
      listTaskParticipants({
        ...project,
        updatedAt: "2026-05-15T07:37:30+07:00"
      })
    ).toThrow("managedProject task participant addedAt cannot be later than project.updatedAt");
  });

  it("returns cloned participants so relation projections cannot mutate project state", () => {
    const project = addTaskParticipant(makeProjectWithTask(), {
      id: "participant-task-1-executor",
      tenantId,
      taskId: "task-1",
      userId: "executor-a",
      role: "executor",
      addedBy: "user-project-manager-a",
      addedAt: "2026-05-15T07:38:00+07:00",
      correlationId: "corr-participant-1"
    });

    const participants = listTaskParticipants(project, { tenantId });
    participants[0]!.role = "observer";

    expect(listTaskParticipants(project, { tenantId })[0]).toMatchObject({
      id: "participant-task-1-executor",
      role: "executor"
    });
  });
});
