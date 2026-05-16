import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import {
  addTaskComment,
  addTaskParticipant,
  approveStageApprovalRequest,
  changeTaskStatus,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createStageApprovalRequest,
  createTaskFromStageTaskTemplate,
  listProjectTasks,
  listTaskComments,
  listTaskParticipants,
  listTaskStatusHistory,
  listTasksByParticipant,
  recordProjectArtifactEvidence,
  updateTaskPlanningFields
} from "@kiss-pm/project-core";
import type {
  ManagedProject,
  ProcessTemplate,
  ProjectArtifactStatus,
  ProjectDraft,
  ProjectLifecycleTransition,
  ProjectLifecycleTransitionResult,
  Task,
  TaskParticipant,
  TaskParticipantRole,
  TaskStatus
} from "@kiss-pm/project-core";
import { evaluateProjectLifecycleTransition } from "@kiss-pm/workflow-engine";

const PHASE4_TIMESTAMP_START = Date.parse("2026-05-15T10:00:00+07:00");
const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done", "cancelled"];

export type Phase4RuntimeState = ReturnType<typeof createPhase4RuntimeState>;

export type Phase4CreateProjectInput = {
  tenantId: TenantId;
  actorId: TenantUserId;
  projectDraft: ProjectDraft;
  projectId?: string;
};

export type Phase4CreateTaskParticipantInput = {
  id?: string;
  userId: TenantUserId;
  role: TaskParticipantRole;
};

export type Phase4CreateTaskInput = {
  tenantId: TenantId;
  actorId: TenantUserId;
  projectId: string;
  id?: string;
  stageId: string;
  taskTemplateId: string;
  taskTemplateKey: string;
  title?: string;
  status?: TaskStatus;
  dueDate: string;
  plannedWorkHours: number;
  participants?: Phase4CreateTaskParticipantInput[];
};

export type Phase4CreateTaskResult = {
  project: ManagedProject;
  task: Task;
  participants: TaskParticipant[];
};

export type Phase4UpdateTaskPlanningFieldsResult = {
  project: ManagedProject;
  task: Task;
};

export type Phase4MyTaskProjection = Task & {
  relationRoles: TaskParticipantRole[];
};

export type Phase4KanbanColumnProjection = {
  status: TaskStatus;
  tasks: Task[];
};

function cloneManagedProject(project: ManagedProject): ManagedProject {
  return structuredClone(project) as ManagedProject;
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw Object.assign(new Error(`${fieldName} is required`), { code: "validation_error" });
  }

  return value;
}

function projectStorageKey(tenantId: TenantId, projectId: string): string {
  return `${tenantId}:${projectId}`;
}

function createPhase4ProcessTemplate(tenantId: TenantId): ProcessTemplate {
  return createProcessTemplate({
    id: `process-template-integrations-${tenantId}`,
    tenantId,
    key: "implementation.integration_heavy",
    label: tenantId === "tenant-a" ? "Внедрение с интеграциями" : "Tenant B private implementation",
    active: true,
    version: 2,
    updatedAt: "2026-05-15T09:50:00+07:00",
    stages: [
      {
        id: "stage-initiation",
        tenantId,
        key: "initiation",
        label: "Инициация",
        sortOrder: 10,
        active: true,
        version: 1,
        updatedAt: "2026-05-15T09:49:00+07:00",
        requiredArtifactTemplates: [
          {
            id: "artifact-charter",
            tenantId,
            key: "project_charter",
            label: "Паспорт проекта",
            required: true
          }
        ],
        approvalTemplates: [
          {
            id: "approval-charter",
            tenantId,
            key: "charter_approval",
            label: "Согласование паспорта",
            approverRoleKey: "project_principal",
            required: true
          }
        ],
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
        version: 1,
        updatedAt: "2026-05-15T09:49:00+07:00",
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

export function createPhase4RuntimeState() {
  const processTemplates = new Map<TenantId, ProcessTemplate>();
  const projects = new Map<string, ManagedProject>();
  let timestampCounter = 0;

  function now(): string {
    timestampCounter += 1;
    return new Date(PHASE4_TIMESTAMP_START + timestampCounter * 60_000).toISOString();
  }

  function getProcessTemplate(tenantId: TenantId): ProcessTemplate {
    const existingTemplate = processTemplates.get(tenantId);
    if (existingTemplate !== undefined) {
      return createProcessTemplate(existingTemplate);
    }
    const template = createPhase4ProcessTemplate(tenantId);
    processTemplates.set(tenantId, createProcessTemplate(template));

    return createProcessTemplate(template);
  }

  function getTenantProject(tenantId: TenantId, projectId: string): ManagedProject | undefined {
    const project = projects.get(projectStorageKey(tenantId, projectId));
    return project?.tenantId === tenantId ? cloneManagedProject(project) : undefined;
  }

  function setProject(project: ManagedProject): ManagedProject {
    const storedProject = cloneManagedProject(project);
    projects.set(projectStorageKey(storedProject.tenantId, storedProject.id), storedProject);

    return cloneManagedProject(storedProject);
  }

  function findTaskProject(tenantId: TenantId, taskId: string): ManagedProject | undefined {
    for (const project of projects.values()) {
      if (project.tenantId !== tenantId) continue;
      if (project.tasks.some((task) => task.id === taskId)) {
        return cloneManagedProject(project);
      }
    }

    return undefined;
  }

  function nextProjectScopedId(project: ManagedProject, entity: string): string {
    const existingCount =
      project.tasks.length +
      project.taskParticipants.length +
      project.taskComments.length +
      project.taskStatusHistory.length +
      project.artifacts.length +
      project.approvalRequests.length;

    return `${project.id}:${entity}:${existingCount + 1}`;
  }

  function readTask(project: ManagedProject, taskId: string): Task {
    const task = listProjectTasks(project).find((candidate) => candidate.id === taskId);
    if (task === undefined) {
      throw Object.assign(new Error("task not found"), { code: "not_found" });
    }

    return task;
  }

  return {
    now,

    createManagedProjectFromTemplate(input: Phase4CreateProjectInput): ManagedProject {
      const tenantId = requireNonEmptyString(input.tenantId, "project.tenantId");
      if (input.projectDraft.tenantId !== tenantId) {
        throw Object.assign(new Error("project draft tenant mismatch"), { code: "tenant_mismatch" });
      }
      const projectId = input.projectId ?? `project-${input.projectDraft.id}`;
      if (getTenantProject(tenantId, projectId) !== undefined) {
        throw Object.assign(new Error("project already exists"), { code: "conflict" });
      }
      const project = createManagedProjectFromDraft({
        id: projectId,
        draft: input.projectDraft,
        processTemplate: getProcessTemplate(tenantId),
        createdBy: requireNonEmptyString(input.actorId, "project.actorId"),
        createdAt: now(),
        correlationId: `corr-project-from-template-${projectId}`
      });

      return setProject(project);
    },

    getProject: getTenantProject,

    transitionProjectStage(
      tenantId: TenantId,
      projectId: string,
      stageId: string,
      transition: ProjectLifecycleTransition,
      actorId: TenantUserId
    ): ProjectLifecycleTransitionResult {
      const project = getTenantProject(tenantId, projectId);
      if (project === undefined) {
        throw Object.assign(new Error("project not found"), { code: "not_found" });
      }
      const result = evaluateProjectLifecycleTransition(project, {
        tenantId,
        actorId,
        transition,
        currentStageId: stageId,
        occurredAt: now(),
        correlationId: `corr-project-transition-${projectId}-${transition}`
      });
      if (result.ok) {
        setProject(result.project);
      }

      return result;
    },

    recordArtifact(input: {
      tenantId: TenantId;
      projectId: string;
      stageId: string;
      id?: string;
      templateId: string;
      templateKey: string;
      status: ProjectArtifactStatus;
      evidenceRef?: string;
      actorId: TenantUserId;
    }): ManagedProject {
      const project = getTenantProject(input.tenantId, input.projectId);
      if (project === undefined) {
        throw Object.assign(new Error("project not found"), { code: "not_found" });
      }
      const nextProject = recordProjectArtifactEvidence(project, {
        id: input.id ?? nextProjectScopedId(project, "artifact"),
        tenantId: input.tenantId,
        stageId: input.stageId,
        templateId: input.templateId,
        templateKey: input.templateKey,
        status: input.status,
        ...(input.evidenceRef !== undefined ? { evidenceRef: input.evidenceRef } : {}),
        actorId: input.actorId,
        occurredAt: now()
      });

      return setProject(nextProject);
    },

    recordApproval(input: {
      tenantId: TenantId;
      projectId: string;
      stageId: string;
      id?: string;
      templateId: string;
      templateKey: string;
      decision?: "approved";
      actorId: TenantUserId;
    }): ManagedProject {
      const project = getTenantProject(input.tenantId, input.projectId);
      if (project === undefined) {
        throw Object.assign(new Error("project not found"), { code: "not_found" });
      }
      const requestId = input.id ?? nextProjectScopedId(project, "approval");
      const withRequest = createStageApprovalRequest(project, {
        id: requestId,
        tenantId: input.tenantId,
        stageId: input.stageId,
        templateId: input.templateId,
        templateKey: input.templateKey,
        requestedBy: input.actorId,
        requestedAt: now()
      });
      if (input.decision !== "approved") {
        return setProject(withRequest);
      }
      const approvedProject = approveStageApprovalRequest(withRequest, {
        tenantId: input.tenantId,
        approvalRequestId: requestId,
        decidedBy: input.actorId,
        decidedAt: now()
      });

      return setProject(approvedProject);
    },

    createTask(input: Phase4CreateTaskInput): Phase4CreateTaskResult {
      const project = getTenantProject(input.tenantId, input.projectId);
      if (project === undefined) {
        throw Object.assign(new Error("project not found"), { code: "not_found" });
      }
      const taskId = input.id ?? nextProjectScopedId(project, "task");
      if ([...projects.values()].some((candidate) => candidate.tenantId === input.tenantId && candidate.tasks.some((task) => task.id === taskId))) {
        throw Object.assign(new Error("task id must be unique inside tenant API namespace"), { code: "conflict" });
      }
      let nextProject = createTaskFromStageTaskTemplate(project, {
        id: taskId,
        tenantId: input.tenantId,
        stageId: input.stageId,
        taskTemplateId: input.taskTemplateId,
        taskTemplateKey: input.taskTemplateKey,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        dueDate: input.dueDate,
        plannedWorkHours: input.plannedWorkHours,
        actorId: input.actorId,
        createdAt: now(),
        correlationId: `corr-task-create-${taskId}`
      });
      for (const participant of input.participants ?? []) {
        nextProject = addTaskParticipant(nextProject, {
          id: participant.id ?? `${taskId}:participant:${participant.role}:${participant.userId}`,
          tenantId: input.tenantId,
          taskId,
          userId: participant.userId,
          role: participant.role,
          addedBy: input.actorId,
          addedAt: now(),
          correlationId: `corr-task-participant-${taskId}-${participant.role}-${participant.userId}`
        });
      }
      const storedProject = setProject(nextProject);

      return {
        project: storedProject,
        task: readTask(storedProject, taskId),
        participants: listTaskParticipants(storedProject, { tenantId: input.tenantId, taskId })
      };
    },

    listProjectTasks(tenantId: TenantId, projectId: string): Task[] {
      const project = getTenantProject(tenantId, projectId);
      if (project === undefined) {
        throw Object.assign(new Error("project not found"), { code: "not_found" });
      }

      return listProjectTasks(project);
    },

    updateTaskPlanningFields(input: {
      tenantId: TenantId;
      projectId: string;
      taskId: string;
      dueDate?: string;
      plannedWorkHours?: number;
      actorId: TenantUserId;
    }): Phase4UpdateTaskPlanningFieldsResult {
      const project = getTenantProject(input.tenantId, input.projectId);
      if (project === undefined) {
        throw Object.assign(new Error("project not found"), { code: "not_found" });
      }
      if (!project.tasks.some((task) => task.id === input.taskId)) {
        throw Object.assign(new Error("task not found"), { code: "not_found" });
      }
      const nextProject = updateTaskPlanningFields(project, {
        tenantId: input.tenantId,
        taskId: input.taskId,
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.plannedWorkHours !== undefined ? { plannedWorkHours: input.plannedWorkHours } : {}),
        actorId: input.actorId,
        updatedAt: now(),
        correlationId: `corr-task-planning-${input.taskId}`
      });
      const storedProject = setProject(nextProject);

      return {
        project: storedProject,
        task: readTask(storedProject, input.taskId)
      };
    },

    changeTaskStatus(input: {
      tenantId: TenantId;
      taskId: string;
      toStatus: TaskStatus;
      actorId: TenantUserId;
    }): ManagedProject {
      const project = findTaskProject(input.tenantId, input.taskId);
      if (project === undefined) {
        throw Object.assign(new Error("task not found"), { code: "not_found" });
      }
      const nextProject = changeTaskStatus(project, {
        id: nextProjectScopedId(project, "task-status"),
        tenantId: input.tenantId,
        taskId: input.taskId,
        toStatus: input.toStatus,
        actorId: input.actorId,
        changedAt: now(),
        correlationId: `corr-task-status-${input.taskId}-${input.toStatus}`
      });

      return setProject(nextProject);
    },

    addTaskComment(input: {
      tenantId: TenantId;
      taskId: string;
      body: string;
      authorId: TenantUserId;
    }): ManagedProject {
      const project = findTaskProject(input.tenantId, input.taskId);
      if (project === undefined) {
        throw Object.assign(new Error("task not found"), { code: "not_found" });
      }
      const nextProject = addTaskComment(project, {
        id: nextProjectScopedId(project, "task-comment"),
        tenantId: input.tenantId,
        taskId: input.taskId,
        body: input.body,
        authorId: input.authorId,
        createdAt: now(),
        correlationId: `corr-task-comment-${input.taskId}`
      });

      return setProject(nextProject);
    },

    getTaskProject: findTaskProject,

    listTaskComments(tenantId: TenantId, taskId: string) {
      const project = findTaskProject(tenantId, taskId);
      if (project === undefined) {
        throw Object.assign(new Error("task not found"), { code: "not_found" });
      }

      return listTaskComments(project, { tenantId, taskId });
    },

    listTaskStatusHistory(tenantId: TenantId, taskId: string) {
      const project = findTaskProject(tenantId, taskId);
      if (project === undefined) {
        throw Object.assign(new Error("task not found"), { code: "not_found" });
      }

      return listTaskStatusHistory(project, { tenantId, taskId });
    },

    listMyTasks(tenantId: TenantId, userId: TenantUserId, roles?: TaskParticipantRole[]): Phase4MyTaskProjection[] {
      const result: Phase4MyTaskProjection[] = [];
      for (const project of projects.values()) {
        if (project.tenantId !== tenantId) continue;
        const tasks = listTasksByParticipant(project, { tenantId, userId, ...(roles !== undefined ? { roles } : {}) });
        for (const task of tasks) {
          const relationRoles = listTaskParticipants(project, { tenantId, taskId: task.id, userId, roles }).map(
            (participant) => participant.role
          );
          result.push({ ...task, relationRoles });
        }
      }

      return result.sort((left, right) => left.id.localeCompare(right.id));
    },

    getKanbanProject(tenantId: TenantId, projectId: string): { projectId: string; columns: Phase4KanbanColumnProjection[] } {
      const project = getTenantProject(tenantId, projectId);
      if (project === undefined) {
        throw Object.assign(new Error("project not found"), { code: "not_found" });
      }
      const tasks = listProjectTasks(project);

      return {
        projectId: project.id,
        columns: TASK_STATUSES.map((status) => ({
          status,
          tasks: tasks.filter((task) => task.status === status)
        }))
      };
    }
  };
}
