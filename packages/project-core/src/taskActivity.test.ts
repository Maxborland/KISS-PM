import { describe, expect, it } from "vitest";

import {
  ProjectCoreModelError,
  addTaskComment,
  changeTaskStatus,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  createTaskFromStageTaskTemplate,
  listTaskComments,
  listTaskStatusHistory
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
    updatedAt: "2026-05-15T09:15:00+07:00",
    stages: [
      {
        id: "stage-initiation",
        tenantId,
        key: "initiation",
        label: "Инициация",
        sortOrder: 10,
        active: true,
        version: 4,
        updatedAt: "2026-05-15T09:14:00+07:00",
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
    createdAt: "2026-05-15T09:16:00+07:00",
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
    createdAt: "2026-05-15T09:17:00+07:00",
    correlationId: "corr-task-1"
  });
}

describe("task comments and status history", () => {
  it("adds append-only task comments with actor, timestamp, and correlation id", () => {
    const project = makeProjectWithTask();
    const nextProject = addTaskComment(project, {
      id: "comment-1",
      tenantId,
      taskId: "task-1",
      body: "Нужно уточнить критерий готовности.",
      authorId: "controller-a",
      createdAt: "2026-05-15T09:18:00+07:00",
      correlationId: "corr-comment-1"
    });

    expect(project.taskComments).toEqual([]);
    expect(nextProject.updatedAt).toBe("2026-05-15T09:18:00+07:00");
    expect(nextProject.tasks[0]).toMatchObject({ id: "task-1", status: "todo", updatedAt: "2026-05-15T09:17:00+07:00" });
    expect(nextProject.taskComments).toEqual([
      {
        id: "comment-1",
        tenantId,
        projectId: "project-managed-1",
        stageId: "project-managed-1:stage-initiation",
        taskId: "task-1",
        body: "Нужно уточнить критерий готовности.",
        authorId: "controller-a",
        createdAt: "2026-05-15T09:18:00+07:00",
        correlationId: "corr-comment-1"
      }
    ]);
  });

  it("changes task status and appends before/after status history", () => {
    const project = makeProjectWithTask();
    const inProgress = changeTaskStatus(project, {
      id: "status-history-1",
      tenantId,
      taskId: "task-1",
      toStatus: "in_progress",
      actorId: "executor-a",
      changedAt: "2026-05-15T09:18:00+07:00",
      correlationId: "corr-status-1"
    });
    const done = changeTaskStatus(inProgress, {
      id: "status-history-2",
      tenantId,
      taskId: "task-1",
      toStatus: "done",
      actorId: "executor-a",
      changedAt: "2026-05-15T09:19:00+07:00",
      correlationId: "corr-status-2"
    });

    expect(project.tasks[0]).toMatchObject({ id: "task-1", status: "todo" });
    expect(done.tasks[0]).toMatchObject({
      id: "task-1",
      status: "done",
      updatedAt: "2026-05-15T09:19:00+07:00"
    });
    expect(done.taskStatusHistory).toEqual([
      {
        id: "status-history-1",
        tenantId,
        projectId: "project-managed-1",
        stageId: "project-managed-1:stage-initiation",
        taskId: "task-1",
        fromStatus: "todo",
        toStatus: "in_progress",
        actorId: "executor-a",
        changedAt: "2026-05-15T09:18:00+07:00",
        correlationId: "corr-status-1"
      },
      {
        id: "status-history-2",
        tenantId,
        projectId: "project-managed-1",
        stageId: "project-managed-1:stage-initiation",
        taskId: "task-1",
        fromStatus: "in_progress",
        toStatus: "done",
        actorId: "executor-a",
        changedAt: "2026-05-15T09:19:00+07:00",
        correlationId: "corr-status-2"
      }
    ]);
  });

  it("returns cloned comments and status history", () => {
    const projectWithComment = addTaskComment(makeProjectWithTask(), {
      id: "comment-1",
      tenantId,
      taskId: "task-1",
      body: "Исходный комментарий",
      authorId: "controller-a",
      createdAt: "2026-05-15T09:18:00+07:00",
      correlationId: "corr-comment-1"
    });
    const project = changeTaskStatus(projectWithComment, {
      id: "status-history-1",
      tenantId,
      taskId: "task-1",
      toStatus: "in_progress",
      actorId: "executor-a",
      changedAt: "2026-05-15T09:19:00+07:00",
      correlationId: "corr-status-1"
    });

    const comments = listTaskComments(project, { tenantId, taskId: "task-1" });
    const history = listTaskStatusHistory(project, { tenantId, taskId: "task-1" });
    comments[0]!.body = "Changed outside";
    history[0]!.toStatus = "done";

    expect(listTaskComments(project, { tenantId, taskId: "task-1" })[0]).toMatchObject({ body: "Исходный комментарий" });
    expect(listTaskStatusHistory(project, { tenantId, taskId: "task-1" })[0]).toMatchObject({ toStatus: "in_progress" });
  });

  it("rejects tenant mismatches, unknown tasks, invalid/no-op statuses, and stale timestamps", () => {
    expect(() =>
      addTaskComment(makeProjectWithTask(), {
        id: "comment-wrong-tenant",
        tenantId: "tenant-b",
        taskId: "task-1",
        body: "Wrong tenant",
        authorId: "controller-a",
        createdAt: "2026-05-15T09:18:00+07:00",
        correlationId: "corr-comment-wrong-tenant"
      })
    ).toThrow("taskComment tenant mismatch");

    expect(() =>
      addTaskComment(makeProjectWithTask(), {
        id: "comment-missing-task",
        tenantId,
        taskId: "task-missing",
        body: "Missing task",
        authorId: "controller-a",
        createdAt: "2026-05-15T09:18:00+07:00",
        correlationId: "corr-comment-missing-task"
      })
    ).toThrow("task not found");

    expect(() =>
      changeTaskStatus(makeProjectWithTask(), {
        id: "status-history-noop",
        tenantId,
        taskId: "task-1",
        toStatus: "todo",
        actorId: "executor-a",
        changedAt: "2026-05-15T09:18:00+07:00",
        correlationId: "corr-status-noop"
      })
    ).toThrow("task status transition must change status");

    expect(() =>
      changeTaskStatus(makeProjectWithTask(), {
        id: "status-history-invalid",
        tenantId,
        taskId: "task-1",
        toStatus: "archived" as never,
        actorId: "executor-a",
        changedAt: "2026-05-15T09:18:00+07:00",
        correlationId: "corr-status-invalid"
      })
    ).toThrow("task.status is invalid");

    expect(() =>
      addTaskComment(makeProjectWithTask(), {
        id: "comment-stale",
        tenantId,
        taskId: "task-1",
        body: "Stale comment",
        authorId: "controller-a",
        createdAt: "2026-05-15T09:16:59+07:00",
        correlationId: "corr-comment-stale"
      })
    ).toThrow(ProjectCoreModelError);
  });

  it("rejects malformed persisted comments and status histories before readback", () => {
    const commented = addTaskComment(makeProjectWithTask(), {
      id: "comment-1",
      tenantId,
      taskId: "task-1",
      body: "Исходный комментарий",
      authorId: "controller-a",
      createdAt: "2026-05-15T09:18:00+07:00",
      correlationId: "corr-comment-1"
    });
    const project = changeTaskStatus(commented, {
      id: "status-history-1",
      tenantId,
      taskId: "task-1",
      toStatus: "in_progress",
      actorId: "executor-a",
      changedAt: "2026-05-15T09:19:00+07:00",
      correlationId: "corr-status-1"
    });

    expect(() =>
      listTaskComments({
        ...project,
        taskComments: [{ ...project.taskComments[0]!, taskId: "task-missing" }]
      })
    ).toThrow("managedProject task comment task mismatch");

    expect(() =>
      listTaskComments({
        ...project,
        taskComments: [{ ...project.taskComments[0]!, createdAt: "2026-05-15T09:20:00+07:00" }]
      })
    ).toThrow("managedProject task comment createdAt cannot be later than project.updatedAt");

    expect(() =>
      listTaskStatusHistory({
        ...project,
        taskStatusHistory: [{ ...project.taskStatusHistory[0]!, toStatus: "done" }]
      })
    ).toThrow("managedProject task status history final status mismatch");
  });

  it("rejects persisted status history that is not append-only", () => {
    const inProgress = changeTaskStatus(makeProjectWithTask(), {
      id: "status-history-1",
      tenantId,
      taskId: "task-1",
      toStatus: "in_progress",
      actorId: "executor-a",
      changedAt: "2026-05-15T09:18:00+07:00",
      correlationId: "corr-status-1"
    });
    const done = changeTaskStatus(inProgress, {
      id: "status-history-2",
      tenantId,
      taskId: "task-1",
      toStatus: "done",
      actorId: "executor-a",
      changedAt: "2026-05-15T09:19:00+07:00",
      correlationId: "corr-status-2"
    });

    expect(() =>
      listTaskStatusHistory({
        ...done,
        taskStatusHistory: [...done.taskStatusHistory].reverse()
      })
    ).toThrow("managedProject task status history is not append-only");
  });

  it("rejects persisted status history that is globally reordered across tasks", () => {
    const projectWithTaskOne = makeProjectWithTask();
    const projectWithTaskTwo = createTaskFromStageTaskTemplate(projectWithTaskOne, {
      id: "task-2",
      tenantId,
      stageId: "project-managed-1:stage-initiation",
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      dueDate: "2026-06-06",
      plannedWorkHours: 8,
      actorId: "user-project-manager-a",
      createdAt: "2026-05-15T09:18:00+07:00",
      correlationId: "corr-task-2"
    });
    const taskOneInProgress = changeTaskStatus(projectWithTaskTwo, {
      id: "status-history-1",
      tenantId,
      taskId: "task-1",
      toStatus: "in_progress",
      actorId: "executor-a",
      changedAt: "2026-05-15T09:19:00+07:00",
      correlationId: "corr-status-1"
    });
    const taskTwoInProgress = changeTaskStatus(taskOneInProgress, {
      id: "status-history-2",
      tenantId,
      taskId: "task-2",
      toStatus: "in_progress",
      actorId: "executor-b",
      changedAt: "2026-05-15T09:20:00+07:00",
      correlationId: "corr-status-2"
    });

    expect(() =>
      listTaskStatusHistory({
        ...taskTwoInProgress,
        taskStatusHistory: [...taskTwoInProgress.taskStatusHistory].reverse()
      })
    ).toThrow("managedProject task status history is not append-only");
  });

  it("rejects persisted comments that are not append-only", () => {
    const firstComment = addTaskComment(makeProjectWithTask(), {
      id: "comment-1",
      tenantId,
      taskId: "task-1",
      body: "Первый комментарий",
      authorId: "controller-a",
      createdAt: "2026-05-15T09:18:00+07:00",
      correlationId: "corr-comment-1"
    });
    const secondComment = addTaskComment(firstComment, {
      id: "comment-2",
      tenantId,
      taskId: "task-1",
      body: "Второй комментарий",
      authorId: "executor-a",
      createdAt: "2026-05-15T09:19:00+07:00",
      correlationId: "corr-comment-2"
    });

    expect(() =>
      listTaskComments({
        ...secondComment,
        taskComments: [...secondComment.taskComments].reverse()
      })
    ).toThrow("managedProject task comments are not append-only");
  });
});
