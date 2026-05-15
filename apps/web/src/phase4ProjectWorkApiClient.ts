import type { AuditEventDto } from "./phase2ApiClient";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type ProjectStageStatus = "pending" | "active" | "completed" | "cancelled";

export type TaskParticipantRole = "executor" | "co_executor" | "requester" | "controller" | "approver" | "observer";

export type ProjectDraftSummaryDto = {
  id: string;
  status: string;
};

export type StageTemplateSnapshotDto = {
  id: string;
  key: string;
  label: string;
  version: number;
  requiredArtifactTemplates: Array<{
    id: string;
    key: string;
    label: string;
    required: boolean;
  }>;
  approvalTemplates: Array<{
    id: string;
    key: string;
    label: string;
    approverRoleKey: string;
    required: boolean;
  }>;
  taskTemplates: Array<{
    id: string;
    key: string;
    label: string;
    defaultParticipantRoleKeys: TaskParticipantRole[];
    required: boolean;
  }>;
};

export type ProjectStageDto = {
  id: string;
  tenantId: string;
  projectId: string;
  templateId: string;
  templateKey: string;
  templateVersion: number;
  label: string;
  sortOrder: number;
  status: ProjectStageStatus;
  startedAt?: string;
  completedAt?: string;
};

export type TaskDto = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  plannedWorkHours: number;
  sourceTemplate: {
    type: "stage_task_template";
    processTemplateId: string;
    processTemplateKey: string;
    processTemplateVersion: number;
    stageTemplateId: string;
    stageTemplateKey: string;
    stageTemplateVersion: number;
    taskTemplateId: string;
    taskTemplateKey: string;
    taskTemplateVersion: number;
    defaultParticipantRoleKeys: TaskParticipantRole[];
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
};

export type MyTaskDto = TaskDto & {
  relationRoles: TaskParticipantRole[];
};

export type TaskParticipantDto = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string;
  taskId: string;
  userId: string;
  role: TaskParticipantRole;
  addedBy: string;
  addedAt: string;
  correlationId: string;
};

export type TaskStatusHistoryDto = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string;
  taskId: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  actorId: string;
  changedAt: string;
  correlationId: string;
};

export type TaskCommentDto = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string;
  taskId: string;
  body: string;
  authorId: string;
  createdAt: string;
  correlationId: string;
};

export type ProjectArtifactDto = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string;
  templateId: string;
  templateKey: string;
  status: "submitted" | "accepted" | "rejected";
  evidenceRef?: string;
  actorId: string;
  occurredAt: string;
};

export type ApprovalRequestDto = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string;
  templateId: string;
  templateKey: string;
  requestedBy: string;
  requestedAt: string;
  status: "requested" | "approved";
  decidedBy?: string;
  decidedAt?: string;
};

export type ManagedProjectDto = {
  id: string;
  tenantId: string;
  title: string;
  lifecycleStatus: string;
  currentStageId: string;
  sourceDraftId: string;
  sourceOpportunity: {
    type: "crm_opportunity";
    opportunityId: string;
    title: string;
    accountId?: string;
    contactIds: string[];
    plannedStartDate: string;
    desiredFinishDate: string;
  };
  processTemplateSnapshot: {
    templateId: string;
    key: string;
    label: string;
    version: number;
    active: boolean;
    updatedAt: string;
    stageTemplates: StageTemplateSnapshotDto[];
  };
  stages: ProjectStageDto[];
  stageHistory: unknown[];
  tasks: TaskDto[];
  taskParticipants: TaskParticipantDto[];
  taskComments: TaskCommentDto[];
  taskStatusHistory: TaskStatusHistoryDto[];
  artifacts: ProjectArtifactDto[];
  approvalRequests: ApprovalRequestDto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
};

export type StageGateBlockerDto = {
  code: string;
  message: string;
  stageId: string;
  templateId?: string;
  templateKey?: string;
};

export type KanbanProjectDto = {
  projectId: string;
  columns: Array<{
    status: TaskStatus;
    tasks: TaskDto[];
  }>;
};

export type CreateProjectTaskRequestDto = {
  id?: string;
  stageId: string;
  taskTemplateId: string;
  taskTemplateKey: string;
  status?: TaskStatus;
  dueDate: string;
  plannedWorkHours: number;
  participants?: Array<{
    id?: string;
    userId: string;
    role: TaskParticipantRole;
  }>;
};

export type Phase4ProjectWorkApiClient = {
  ensureProjectDraft(testUser: string, opportunityId: string): Promise<ProjectDraftSummaryDto>;
  createProjectFromTemplate(
    testUser: string,
    request: { projectDraftId: string; projectId?: string }
  ): Promise<ManagedProjectDto>;
  getProject(testUser: string, projectId: string): Promise<ManagedProjectDto>;
  transitionProjectStage(
    testUser: string,
    projectId: string,
    stageId: string,
    transition: "advance_stage" | "complete_project" | "cancel_project"
  ): Promise<ManagedProjectDto>;
  recordArtifact(
    testUser: string,
    projectId: string,
    stageId: string,
    request: {
      id?: string;
      templateId: string;
      templateKey: string;
      status: ProjectArtifactDto["status"];
      evidenceRef?: string;
    }
  ): Promise<ManagedProjectDto>;
  recordApproval(
    testUser: string,
    projectId: string,
    stageId: string,
    request: {
      id?: string;
      templateId: string;
      templateKey: string;
      decision?: "approved";
    }
  ): Promise<ManagedProjectDto>;
  listProjectTasks(testUser: string, projectId: string): Promise<TaskDto[]>;
  createProjectTask(
    testUser: string,
    projectId: string,
    request: CreateProjectTaskRequestDto
  ): Promise<{ task: TaskDto; participants: TaskParticipantDto[]; project: ManagedProjectDto }>;
  changeTaskStatus(
    testUser: string,
    taskId: string,
    toStatus: TaskStatus
  ): Promise<{ task: TaskDto | null; statusHistory: TaskStatusHistoryDto[] }>;
  addTaskComment(testUser: string, taskId: string, body: string): Promise<TaskCommentDto | null>;
  listMyTasks(testUser: string, roles?: TaskParticipantRole[]): Promise<MyTaskDto[]>;
  getKanbanProject(testUser: string, projectId: string): Promise<KanbanProjectDto>;
  listAuditEventsForTarget(testUser: string, targetType: "project" | "task" | "stage", targetId: string): Promise<AuditEventDto[]>;
};

type ApiErrorDto = {
  code: string;
  message: string;
  transitionError?: {
    code: string;
    message: string;
    blockers?: StageGateBlockerDto[];
  };
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = body as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return body as T;
}

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

function jsonInit(method: "POST" | "PATCH", body: unknown): RequestInit {
  return {
    method,
    body: JSON.stringify(body)
  };
}

export function projectDraftIdForSeedOpportunity(opportunityId: string): string {
  return `project-draft-${opportunityId}`;
}

export function createPhase4ProjectWorkApiClient(basePath = "/api/api"): Phase4ProjectWorkApiClient {
  return {
    async ensureProjectDraft(testUser, opportunityId) {
      const draftResponse = await requestJson<{ projectDraft: ProjectDraftSummaryDto }>(
        withUser(`${basePath}/crm/opportunities/${encodeURIComponent(opportunityId)}/project-draft`, testUser),
        jsonInit("POST", {})
      ).catch(async (error: unknown) => {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "conflict") {
          return {
            projectDraft: {
              id: projectDraftIdForSeedOpportunity(opportunityId),
              status: "draft"
            }
          };
        }

        throw error;
      });

      return draftResponse.projectDraft;
    },
    async createProjectFromTemplate(testUser, request) {
      const body = await requestJson<{ project: ManagedProjectDto }>(
        withUser(`${basePath}/projects/from-template`, testUser),
        jsonInit("POST", request)
      );
      return body.project;
    },
    async getProject(testUser, projectId) {
      const body = await requestJson<{ project: ManagedProjectDto }>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}`, testUser)
      );
      return body.project;
    },
    async transitionProjectStage(testUser, projectId, stageId, transition) {
      const body = await requestJson<{ project: ManagedProjectDto }>(
        withUser(
          `${basePath}/projects/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/transition`,
          testUser
        ),
        jsonInit("POST", { transition })
      );
      return body.project;
    },
    async recordArtifact(testUser, projectId, stageId, request) {
      const body = await requestJson<{ project: ManagedProjectDto }>(
        withUser(
          `${basePath}/projects/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/artifacts`,
          testUser
        ),
        jsonInit("POST", request)
      );
      return body.project;
    },
    async recordApproval(testUser, projectId, stageId, request) {
      const body = await requestJson<{ project: ManagedProjectDto }>(
        withUser(
          `${basePath}/projects/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/approvals`,
          testUser
        ),
        jsonInit("POST", request)
      );
      return body.project;
    },
    async listProjectTasks(testUser, projectId) {
      const body = await requestJson<{ tasks: TaskDto[] }>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/tasks`, testUser)
      );
      return body.tasks;
    },
    async createProjectTask(testUser, projectId, request) {
      return requestJson<{ task: TaskDto; participants: TaskParticipantDto[]; project: ManagedProjectDto }>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/tasks`, testUser),
        jsonInit("POST", request)
      );
    },
    async changeTaskStatus(testUser, taskId, toStatus) {
      return requestJson<{ task: TaskDto | null; statusHistory: TaskStatusHistoryDto[] }>(
        withUser(`${basePath}/tasks/${encodeURIComponent(taskId)}/status`, testUser),
        jsonInit("PATCH", { toStatus })
      );
    },
    async addTaskComment(testUser, taskId, body) {
      const response = await requestJson<{ comment: TaskCommentDto | null }>(
        withUser(`${basePath}/tasks/${encodeURIComponent(taskId)}/comments`, testUser),
        jsonInit("POST", { body })
      );
      return response.comment;
    },
    async listMyTasks(testUser, roles) {
      const roleQuery = roles && roles.length > 0 ? `?roles=${encodeURIComponent(roles.join(","))}` : "";
      const body = await requestJson<{ tasks: MyTaskDto[] }>(withUser(`${basePath}/my/tasks${roleQuery}`, testUser));
      return body.tasks;
    },
    async getKanbanProject(testUser, projectId) {
      return requestJson<KanbanProjectDto>(withUser(`${basePath}/kanban/projects/${encodeURIComponent(projectId)}`, testUser));
    },
    async listAuditEventsForTarget(testUser, targetType, targetId) {
      const body = await requestJson<{ events: AuditEventDto[] }>(
        withUser(`${basePath}/audit?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`, testUser)
      );
      return body.events;
    }
  };
}
