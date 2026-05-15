import { describe, expect, it } from "vitest";

import {
  ProjectCoreModelError,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  createTaskFromStageTaskTemplate,
  listProjectTasks
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

function makeProject() {
  return createManagedProjectFromDraft({
    id: "project-managed-1",
    draft: makeDraft(),
    processTemplate: makeProcessTemplate(),
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-15T05:56:00+07:00",
    correlationId: "corr-managed-project-1"
  });
}

describe("canonical task model", () => {
  it("creates one canonical project task from a stage task template snapshot", () => {
    const project = makeProject();
    const nextProject = createTaskFromStageTaskTemplate(project, {
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

    expect(project.tasks).toEqual([]);
    expect(nextProject.tasks).toHaveLength(1);
    expect(nextProject.updatedAt).toBe("2026-05-15T05:57:00+07:00");
    expect(nextProject.tasks[0]).toEqual({
      id: "task-1",
      tenantId,
      projectId: "project-managed-1",
      stageId: "project-managed-1:stage-initiation",
      title: "Провести старт проекта",
      status: "todo",
      dueDate: "2026-06-05",
      plannedWorkHours: 12,
      sourceTemplate: {
        type: "stage_task_template",
        processTemplateId: "process-template-tenant-a-implementation",
        processTemplateVersion: 3,
        stageTemplateId: "stage-initiation",
        stageTemplateKey: "initiation",
        stageTemplateVersion: 4,
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        taskTemplateLabel: "Провести старт проекта",
        required: true,
        defaultParticipantRoleKeys: ["executor", "controller"]
      },
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T05:57:00+07:00",
      updatedAt: "2026-05-15T05:57:00+07:00",
      correlationId: "corr-task-1"
    });
    expect(Object.keys(nextProject.tasks[0] ?? {})).not.toContain("kanbanTaskId");
    expect(Object.keys(nextProject.tasks[0] ?? {})).not.toContain("ganttTaskId");
  });

  it("returns cloned canonical tasks without creating view-specific task copies", () => {
    const project = createTaskFromStageTaskTemplate(makeProject(), {
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

    const tasks = listProjectTasks(project);
    tasks[0]!.title = "Changed outside";
    tasks[0]!.sourceTemplate.defaultParticipantRoleKeys.push("observer");

    expect(listProjectTasks(project)[0]).toMatchObject({
      id: "task-1",
      title: "Провести старт проекта",
      sourceTemplate: {
        defaultParticipantRoleKeys: ["executor", "controller"]
      }
    });
    expect(project.tasks.map((task) => task.id)).toEqual(["task-1"]);
  });

  it("rejects duplicate task ids and invalid task status", () => {
    const project = createTaskFromStageTaskTemplate(makeProject(), {
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

    expect(() =>
      createTaskFromStageTaskTemplate(project, {
        id: "task-1",
        tenantId,
        stageId: "project-managed-1:stage-initiation",
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        status: "done",
        dueDate: "2026-06-06",
        plannedWorkHours: 4,
        actorId: "user-project-manager-a",
        createdAt: "2026-05-15T05:58:00+07:00",
        correlationId: "corr-task-duplicate"
      })
    ).toThrow("task id must be unique");

    expect(() =>
      createTaskFromStageTaskTemplate(makeProject(), {
        id: "task-invalid-status",
        tenantId,
        stageId: "project-managed-1:stage-initiation",
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        status: "archived" as never,
        dueDate: "2026-06-05",
        plannedWorkHours: 12,
        actorId: "user-project-manager-a",
        createdAt: "2026-05-15T05:57:00+07:00",
        correlationId: "corr-task-invalid-status"
      })
    ).toThrow("task.status is invalid");
  });

  it("rejects tenant mismatches, cross-stage templates, and invalid planning fields", () => {
    expect(() =>
      createTaskFromStageTaskTemplate(makeProject(), {
        id: "task-wrong-tenant",
        tenantId: "tenant-b",
        stageId: "project-managed-1:stage-initiation",
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-05",
        plannedWorkHours: 12,
        actorId: "user-project-manager-a",
        createdAt: "2026-05-15T05:57:00+07:00",
        correlationId: "corr-task-wrong-tenant"
      })
    ).toThrow("task tenant mismatch");

    expect(() =>
      createTaskFromStageTaskTemplate(makeProject(), {
        id: "task-cross-stage",
        tenantId,
        stageId: "project-managed-1:stage-initiation",
        taskTemplateId: "task-template-delivery",
        taskTemplateKey: "delivery_work",
        dueDate: "2026-06-05",
        plannedWorkHours: 12,
        actorId: "user-project-manager-a",
        createdAt: "2026-05-15T05:57:00+07:00",
        correlationId: "corr-task-cross-stage"
      })
    ).toThrow("task template is not valid for stage");

    expect(() =>
      createTaskFromStageTaskTemplate(makeProject(), {
        id: "task-invalid-plan",
        tenantId,
        stageId: "project-managed-1:stage-initiation",
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-02-30",
        plannedWorkHours: -1,
        actorId: "user-project-manager-a",
        createdAt: "2026-05-15T05:57:00+07:00",
        correlationId: "corr-task-invalid-plan"
      })
    ).toThrow(ProjectCoreModelError);
  });

  it("rejects persisted tasks whose source template no longer matches the project snapshot", () => {
    const project = createTaskFromStageTaskTemplate(makeProject(), {
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
    const task = project.tasks[0]!;
    const corruptedProject = {
      ...project,
      tasks: [
        {
          ...task,
          sourceTemplate: {
            ...task.sourceTemplate,
            taskTemplateId: "task-template-delivery",
            taskTemplateKey: "delivery_work"
          }
        }
      ]
    };

    expect(() => listProjectTasks(corruptedProject)).toThrow("managedProject task source template mismatch: task-1");
  });

  it("rejects persisted tasks with impossible update chronology", () => {
    const project = createTaskFromStageTaskTemplate(makeProject(), {
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
    const task = project.tasks[0]!;

    expect(() =>
      listProjectTasks({
        ...project,
        tasks: [{ ...task, updatedAt: "2026-05-15T05:56:59+07:00" }]
      })
    ).toThrow("task.updatedAt cannot be earlier than task.createdAt");

    expect(() =>
      listProjectTasks({
        ...project,
        updatedAt: "2026-05-15T05:56:30+07:00"
      })
    ).toThrow("managedProject task updatedAt cannot be later than project.updatedAt");
  });

  it("rejects ambiguous persisted stage template snapshots before task creation", () => {
    const project = makeProject();
    const initiationTemplate = project.processTemplateSnapshot.stageTemplates[0]!;
    const ambiguousProject = {
      ...project,
      processTemplateSnapshot: {
        ...project.processTemplateSnapshot,
        stageTemplates: [
          initiationTemplate,
          {
            ...initiationTemplate,
            version: initiationTemplate.version + 1,
            taskTemplates: [
              {
                id: "task-template-kickoff-v2",
                key: "kickoff_v2",
                label: "Новая версия старта",
                defaultParticipantRoleKeys: ["executor"],
                required: true
              }
            ]
          },
          project.processTemplateSnapshot.stageTemplates[1]!
        ]
      }
    };

    expect(() =>
      createTaskFromStageTaskTemplate(ambiguousProject, {
        id: "task-ambiguous",
        tenantId,
        stageId: "project-managed-1:stage-initiation",
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-05",
        plannedWorkHours: 12,
        actorId: "user-project-manager-a",
        createdAt: "2026-05-15T05:57:00+07:00",
        correlationId: "corr-task-ambiguous"
      })
    ).toThrow("managedProject process template snapshot stage ids must be unique");
  });

  it("rejects ambiguous persisted task template snapshots before task creation", () => {
    const project = makeProject();
    const initiationTemplate = project.processTemplateSnapshot.stageTemplates[0]!;
    const ambiguousProject = {
      ...project,
      processTemplateSnapshot: {
        ...project.processTemplateSnapshot,
        stageTemplates: [
          {
            ...initiationTemplate,
            taskTemplates: [
              initiationTemplate.taskTemplates[0]!,
              {
                ...initiationTemplate.taskTemplates[0]!,
                key: "kickoff_duplicate"
              }
            ]
          },
          project.processTemplateSnapshot.stageTemplates[1]!
        ]
      }
    };

    expect(() =>
      createTaskFromStageTaskTemplate(ambiguousProject, {
        id: "task-ambiguous-template",
        tenantId,
        stageId: "project-managed-1:stage-initiation",
        taskTemplateId: "task-template-kickoff",
        taskTemplateKey: "kickoff",
        dueDate: "2026-06-05",
        plannedWorkHours: 12,
        actorId: "user-project-manager-a",
        createdAt: "2026-05-15T05:57:00+07:00",
        correlationId: "corr-task-ambiguous-template"
      })
    ).toThrow("managedProject process template snapshot stage task template ids must be unique");

    expect(() =>
      listProjectTasks({
        ...project,
        processTemplateSnapshot: {
          ...project.processTemplateSnapshot,
          stageTemplates: [
            {
              ...initiationTemplate,
              taskTemplates: [
                {
                  ...initiationTemplate.taskTemplates[0]!,
                  defaultParticipantRoleKeys: ["executor", "executor"]
                }
              ]
            },
            project.processTemplateSnapshot.stageTemplates[1]!
          ]
        }
      })
    ).toThrow("managedProject process template snapshot stage task template default participant role keys must be unique");
  });
});
