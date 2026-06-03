"use client";

import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import { fetchWorkspaceAccessRoles, type AccessRole } from "@/lib/api/bootstrap";
import type {
  AuditEventListItem,
  Client,
  Contact,
  DealStage,
  OperationsCockpitReadModel,
  Opportunity,
  Product,
  Project,
  ProjectTemplate,
  ScheduledTask,
  Task,
  TaskActivity,
  TaskStatus,
  WorkspaceUser
} from "@/lib/api-types";
import { queryKeys } from "@/lib/api/query-keys";

type ListResponse<Key extends string, Item> = Record<Key, Item[]>;
type WorkspaceOperationsCockpitResponse = {
  cockpit: OperationsCockpitReadModel;
};

const EMPTY_OPERATIONS_COCKPIT: OperationsCockpitReadModel = {
  generatedAt: "",
  scope: {
    type: "workspace",
    tenantId: ""
  },
  indicators: {
    activeProjects: 0,
    overdueProjects: 0,
    activeTasks: 0,
    overdueTasks: 0,
    waitingTasks: 0,
    criticalTasks: 0,
    openDeals: 0,
    readyToActivateDeals: 0
  },
  attentionItems: [],
  workloadHints: {
    byPerson: []
  },
  pipelinePressure: {
    deals: []
  },
  agentContext: {
    contextType: "operations_cockpit",
    focus: {
      type: "workspace",
      tenantId: ""
    },
    generatedAt: "",
    sourceEntityTypes: [],
    unavailableSources: [
      {
        source: "operations_cockpit",
        reason: "persistence_not_configured"
      }
    ]
  }
};

export type ProjectsListReadModel = {
  projects: Project[];
  projectTemplates: ProjectTemplate[];
};

export type ProjectDetailReadModel = {
  project: Project;
  taskStatuses: TaskStatus[];
  tasks: Task[];
  workspaceUsers: WorkspaceUser[];
};

export type TaskActivityReadModel = {
  activities: TaskActivity[];
};

export type DealsBoardReadModel = {
  opportunities: Opportunity[];
  dealStages: DealStage[];
};

export type DealDetailReadModel = {
  opportunity: Opportunity;
};

export type MyWorkReadModel = {
  tasks: Task[];
  scheduledTasks: ScheduledTask[];
  taskStatuses: TaskStatus[];
  workspaceUsers: WorkspaceUser[];
};

export type DashboardReadModel = {
  projects: Project[];
  tasks: Task[];
  scheduledTasks: ScheduledTask[];
  operationsCockpit: OperationsCockpitReadModel;
  workspaceAgentThread: WorkspaceAgentThread;
};

export type AgentCockpitReadModel = {
  operationsCockpit: OperationsCockpitReadModel;
  workspaceAgentThread: WorkspaceAgentThread;
};

export type AuditEventsReadModel = {
  auditEvents: AuditEventListItem[];
};

export type AdminUsersReadModel = {
  users: WorkspaceUser[];
};

export type AdminAccessRolesReadModel = {
  accessRoles: AccessRole[];
};

export type ClientsReadModel = {
  clients: Client[];
};

export type ContactsReadModel = {
  contacts: Contact[];
};

export type ProductsReadModel = {
  products: Product[];
};

export type WorkspaceAgentFocusType = "project" | "task" | "deal";

export type WorkspaceAgentContextFocus = {
  type: WorkspaceAgentFocusType;
  id: string;
  title?: string;
};

export type WorkspaceAgentThreadContext = {
  focus?: WorkspaceAgentContextFocus;
};

export type WorkspaceAgentContextInput = {
  dealId?: string | undefined;
  projectId?: string | undefined;
  taskId?: string | undefined;
};

export type WorkspaceAgentMessage = {
  id: string;
  authorUserId: string;
  authorType: "user" | "agent";
  body: string;
  context: WorkspaceAgentThreadContext;
  createdAt: string;
};

export type WorkspaceAgentProposalStatus = "proposed" | "applying" | "applied" | "rejected";
export type WorkspaceAgentConfirmationDecision = "apply" | "reject";

export type WorkspaceAgentThreadDescriptor = {
  kind: "workspace_agent_cockpit";
  scope: { type: "workspace"; tenantId: string };
  context: WorkspaceAgentThreadContext;
};

export type WorkspaceAgentMutationPolicy = {
  mode: "confirmation_required";
  messagePostMutatesWorkspace: false;
  mutationEndpoint: "/api/workspace/agent-thread/proposals/:proposalId/confirm";
  allowedDecisions: WorkspaceAgentConfirmationDecision[];
};

export type WorkspaceAgentProposalConfirmation = {
  required: true;
  status: "available" | "closed";
  endpoint: string;
  allowedDecisions: WorkspaceAgentConfirmationDecision[];
  mutationOnlyOnApply: true;
};

export type WorkspaceAgentActionResultSummary = {
  status: "pending" | "succeeded" | "rejected";
  mutationApplied: boolean;
  changedEntity: { type: "Task"; id: string; title: string } | null;
  auditEventId: string | null;
  description: string;
};

export type WorkspaceAgentActionProposal = {
  id: string;
  messageId: string;
  actionType: string;
  title: string;
  description: string;
  context: WorkspaceAgentThreadContext;
  payload: Record<string, unknown>;
  status: WorkspaceAgentProposalStatus;
  auditEventId: string | null;
  confirmation?: WorkspaceAgentProposalConfirmation;
  resultSummary?: WorkspaceAgentActionResultSummary;
  createdAt: string;
  resolvedAt: string | null;
};

export type WorkspaceAgentThread = {
  thread?: WorkspaceAgentThreadDescriptor;
  mutationPolicy?: WorkspaceAgentMutationPolicy;
  context: WorkspaceAgentThreadContext;
  messages: WorkspaceAgentMessage[];
  proposals: WorkspaceAgentActionProposal[];
};

export type ScheduledTasksQueryInput = {
  assigneeUserId: string;
  fromDate: string;
  toDate: string;
};

export type RuntimeTaskReadModelInput = {
  assigneeUserId: string;
  fromDate?: string;
  toDate?: string;
};

export type CreateWorkspaceProjectTaskInput = {
  projectId: string;
  title: string;
  ownerUserId: string;
  dueDate: string;
  statusId?: string | undefined;
};

export type UpdateWorkspaceTaskFieldsInput = {
  task: Task;
  ownerUserId?: string | undefined;
  dueDate?: string | undefined;
};

export type PostWorkspaceTaskCommentInput = {
  taskId: string;
  body: string;
};

export type WorkspaceUserStatusUpdateInput = {
  userId: string;
  status: "active" | "inactive";
};

export type UpdateWorkspaceAccessRolePermissionInput = {
  role: AccessRole;
  permission: string;
  enabled: boolean;
};

export async function fetchWorkspaceProjects(): Promise<Project[]> {
  const response = await apiFetch<ListResponse<"projects", Project>>("/api/workspace/projects", {
    method: "GET"
  });
  return response.projects;
}

export async function fetchWorkspaceProjectDetail(projectId: string): Promise<ProjectDetailReadModel> {
  const response = await apiFetch<Omit<ProjectDetailReadModel, "taskStatuses" | "workspaceUsers">>(
    `/api/workspace/projects/${encodeURIComponent(projectId)}`,
    { method: "GET" }
  );
  return {
    ...response,
    taskStatuses: [],
    workspaceUsers: []
  };
}

export async function fetchWorkspaceTaskStatuses(): Promise<TaskStatus[]> {
  const response = await apiFetch<ListResponse<"taskStatuses", TaskStatus>>(
    "/api/workspace/task-statuses",
    { method: "GET" }
  );
  return response.taskStatuses;
}

export async function fetchWorkspaceTaskActivity(taskId: string): Promise<TaskActivity[]> {
  const response = await apiFetch<ListResponse<"activities", TaskActivity>>(
    `/api/workspace/tasks/${encodeURIComponent(taskId)}/activity`,
    { method: "GET" }
  );
  return response.activities;
}

export async function updateWorkspaceProjectTaskStatus(input: {
  projectId: string;
  taskId: string;
  statusId: string;
}): Promise<Task> {
  const response = await apiFetch<{ task: Task }>(
    `/api/workspace/projects/${encodeURIComponent(input.projectId)}/tasks/${encodeURIComponent(input.taskId)}/status`,
    {
      method: "PATCH",
      json: { statusId: input.statusId }
    }
  );
  return response.task;
}

export async function createWorkspaceProjectTask(
  input: CreateWorkspaceProjectTaskInput
): Promise<Task> {
  const response = await apiFetch<{ task: Task }>(
    `/api/workspace/projects/${encodeURIComponent(input.projectId)}/tasks`,
    {
      method: "POST",
      json: {
        description: null,
        durationWorkingDays: 1,
        participants: [{ role: "executor", userId: input.ownerUserId }],
        plannedFinish: input.dueDate,
        plannedStart: input.dueDate,
        plannedWork: 1,
        priority: "normal",
        requiresAcceptance: false,
        statusId: input.statusId,
        title: input.title.trim()
      }
    }
  );
  return response.task;
}

export async function updateWorkspaceTaskFields(
  input: UpdateWorkspaceTaskFieldsInput
): Promise<Task> {
  const ownerUserId = input.ownerUserId ?? input.task.ownerUserId;
  const plannedFinish = input.dueDate ?? input.task.plannedFinish.slice(0, 10);
  const participants = upsertTaskExecutor(input.task.participants, ownerUserId);
  const response = await apiFetch<{ task: Task }>(
    `/api/workspace/tasks/${encodeURIComponent(input.task.id)}`,
    {
      method: "PATCH",
      json: {
        clientUpdatedAt: input.task.updatedAt,
        description: input.task.description,
        durationWorkingDays: input.task.durationWorkingDays,
        participants,
        plannedFinish,
        plannedStart: input.task.plannedStart.slice(0, 10),
        plannedWork: input.task.plannedWork,
        priority: input.task.priority,
        requiresAcceptance: input.task.requiresAcceptance,
        statusId: input.task.statusId,
        title: input.task.title
      }
    }
  );
  return response.task;
}

export async function postWorkspaceTaskComment(
  input: PostWorkspaceTaskCommentInput
): Promise<TaskActivity> {
  const response = await apiFetch<{ activity: TaskActivity }>(
    `/api/workspace/tasks/${encodeURIComponent(input.taskId)}/comments`,
    {
      method: "POST",
      json: { body: input.body.trim() }
    }
  );
  return response.activity;
}

function upsertTaskExecutor(
  participants: Task["participants"],
  ownerUserId: string
): Task["participants"] {
  const withoutExecutor = participants.filter((participant) => participant.role !== "executor");
  return [{ role: "executor", userId: ownerUserId }, ...withoutExecutor];
}

export async function fetchWorkspaceUsers(): Promise<WorkspaceUser[]> {
  const response = await apiFetch<ListResponse<"users", WorkspaceUser>>("/api/workspace/users", {
    method: "GET"
  });
  return response.users;
}

export async function updateWorkspaceUserStatus(
  input: WorkspaceUserStatusUpdateInput
): Promise<WorkspaceUser> {
  const response = await apiFetch<{ user: WorkspaceUser }>(
    `/api/workspace/users/${encodeURIComponent(input.userId)}`,
    {
      method: "PATCH",
      json: { status: input.status }
    }
  );
  return response.user;
}

export async function updateWorkspaceAccessRolePermission(
  input: UpdateWorkspaceAccessRolePermissionInput
): Promise<AccessRole> {
  const permissions = input.enabled
    ? Array.from(new Set([...input.role.permissions, input.permission]))
    : input.role.permissions.filter((permission) => permission !== input.permission);
  const response = await apiFetch<{ accessRole: AccessRole }>(
    `/api/workspace/access-roles/${encodeURIComponent(input.role.id)}`,
    {
      method: "PATCH",
      json: {
        name: input.role.name,
        permissions
      }
    }
  );
  return response.accessRole;
}

export async function fetchWorkspaceClients(): Promise<Client[]> {
  const response = await apiFetch<ListResponse<"clients", Client>>("/api/workspace/clients", {
    method: "GET"
  });
  return response.clients;
}

export async function fetchWorkspaceContacts(): Promise<Contact[]> {
  const response = await apiFetch<ListResponse<"contacts", Contact>>("/api/workspace/contacts", {
    method: "GET"
  });
  return response.contacts;
}

export async function fetchWorkspaceProducts(): Promise<Product[]> {
  const response = await apiFetch<ListResponse<"products", Product>>("/api/workspace/products", {
    method: "GET"
  });
  return response.products;
}

async function fetchOptionalWorkspaceUsers(): Promise<WorkspaceUser[]> {
  try {
    return await fetchWorkspaceUsers();
  } catch (error) {
    if (error instanceof ApiError && error.code === "forbidden") return [];
    throw error;
  }
}

export async function fetchWorkspaceProjectTemplates(): Promise<ProjectTemplate[]> {
  const response = await apiFetch<ListResponse<"projectTemplates", ProjectTemplate>>(
    "/api/workspace/config/project-templates",
    { method: "GET" }
  );
  return response.projectTemplates;
}

async function fetchOptionalWorkspaceProjectTemplates(): Promise<ProjectTemplate[]> {
  try {
    return await fetchWorkspaceProjectTemplates();
  } catch (error) {
    if (error instanceof ApiError && error.code === "forbidden") return [];
    throw error;
  }
}

export async function fetchWorkspaceMyWorkTasks(): Promise<Task[]> {
  const response = await apiFetch<ListResponse<"tasks", Task>>("/api/workspace/my-work", {
    method: "GET"
  });
  return response.tasks;
}

export async function fetchTenantCurrentScheduledTasks({
  assigneeUserId,
  fromDate,
  toDate
}: ScheduledTasksQueryInput): Promise<ScheduledTask[]> {
  const searchParams = new URLSearchParams({ assigneeUserId, fromDate, toDate });
  const response = await apiFetch<ListResponse<"tasks", ScheduledTask>>(
    `/api/tenant/current/scheduled-tasks?${searchParams.toString()}`,
    { method: "GET" }
  );
  return response.tasks;
}

export async function fetchWorkspaceOpportunities(): Promise<Opportunity[]> {
  const response = await apiFetch<ListResponse<"opportunities", Opportunity>>(
    "/api/workspace/opportunities",
    { method: "GET" }
  );
  return response.opportunities;
}

export async function fetchWorkspaceOpportunity(opportunityId: string): Promise<Opportunity> {
  const response = await apiFetch<{ opportunity: Opportunity }>(
    `/api/workspace/opportunities/${encodeURIComponent(opportunityId)}`,
    { method: "GET" }
  );
  return response.opportunity;
}

export async function changeWorkspaceOpportunityStage(input: {
  opportunityId: string;
  stageId: string;
}): Promise<Opportunity> {
  const response = await apiFetch<{ opportunity: Opportunity }>(
    `/api/workspace/opportunities/${encodeURIComponent(input.opportunityId)}/stage`,
    {
      method: "PATCH",
      json: { stageId: input.stageId }
    }
  );
  return response.opportunity;
}

export async function activateWorkspaceOpportunityProject(input: {
  acceptedRiskReason?: string | null;
  opportunityId: string;
}): Promise<Project> {
  const response = await apiFetch<{ project: Project }>(
    `/api/workspace/opportunities/${encodeURIComponent(input.opportunityId)}/activate`,
    {
      method: "POST",
      json: { acceptedRiskReason: input.acceptedRiskReason ?? null }
    }
  );
  return response.project;
}

export async function fetchWorkspaceDealStages(): Promise<DealStage[]> {
  const response = await apiFetch<ListResponse<"dealStages", DealStage>>("/api/workspace/deal-stages", {
    method: "GET"
  });
  return response.dealStages;
}

export async function fetchWorkspaceAgentThread(
  context?: WorkspaceAgentContextInput | undefined
): Promise<WorkspaceAgentThread> {
  const query = workspaceAgentContextSearchParams(context);
  return apiFetch<WorkspaceAgentThread>(`/api/workspace/agent-thread${query}`, { method: "GET" });
}

export async function fetchWorkspaceOperationsCockpit(): Promise<OperationsCockpitReadModel> {
  try {
    const response = await apiFetch<WorkspaceOperationsCockpitResponse>(
      "/api/workspace/operations-cockpit",
      { method: "GET" }
    );
    return response.cockpit;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 501 &&
      error.body.error === "persistence_not_configured"
    ) {
      return EMPTY_OPERATIONS_COCKPIT;
    }
    throw error;
  }
}

export async function fetchTenantCurrentAuditEvents(): Promise<AuditEventListItem[]> {
  const response = await apiFetch<ListResponse<"auditEvents", AuditEventListItem>>(
    "/api/tenant/current/audit-events",
    { method: "GET" }
  );
  return response.auditEvents;
}

export async function postWorkspaceAgentMessage(
  body: string,
  context?: WorkspaceAgentContextInput | undefined
): Promise<WorkspaceAgentThread> {
  return apiFetch<WorkspaceAgentThread>("/api/workspace/agent-thread/messages", {
    method: "POST",
    json: hasWorkspaceAgentContext(context) ? { body, context } : body
  });
}

export async function confirmWorkspaceAgentProposal(input: {
  proposalId: string;
  decision: WorkspaceAgentConfirmationDecision;
}): Promise<WorkspaceAgentThread> {
  return apiFetch<WorkspaceAgentThread>(
    `/api/workspace/agent-thread/proposals/${input.proposalId}/confirm`,
    {
      method: "POST",
      json: { decision: input.decision }
    }
  );
}

export function useProjectsListReadModelQuery() {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.workspace.projects,
        queryFn: fetchWorkspaceProjects
      },
      {
        queryKey: queryKeys.workspace.projectTemplates,
        queryFn: fetchOptionalWorkspaceProjectTemplates
      }
    ]
  });

  const [projectsQuery, projectTemplatesQuery] = queries;
  const data =
    projectsQuery.data && projectTemplatesQuery.data
      ? {
          projects: projectsQuery.data as Project[],
          projectTemplates: projectTemplatesQuery.data as ProjectTemplate[]
        }
      : undefined;

  return aggregateQueries<ProjectsListReadModel>(queries, data);
}

export function useProjectDetailReadModelQuery(projectId: string | undefined) {
  const queries = useQueries({
    queries: [
      {
        enabled: Boolean(projectId),
        queryKey: projectId ? queryKeys.workspace.project(projectId) : queryKeys.workspace.project(""),
        queryFn: () => {
          if (!projectId) throw new Error("project_id_required");
          return fetchWorkspaceProjectDetail(projectId);
        }
      },
      {
        enabled: Boolean(projectId),
        queryKey: queryKeys.workspace.taskStatuses,
        queryFn: fetchWorkspaceTaskStatuses
      },
      {
        enabled: Boolean(projectId),
        queryKey: queryKeys.workspace.users,
        queryFn: fetchOptionalWorkspaceUsers
      }
    ]
  });
  const [projectDetailQuery, taskStatusesQuery, workspaceUsersQuery] = queries;
  const data =
    projectDetailQuery.data && taskStatusesQuery.data && workspaceUsersQuery.data
      ? {
          ...(projectDetailQuery.data as ProjectDetailReadModel),
          taskStatuses: taskStatusesQuery.data as TaskStatus[],
          workspaceUsers: workspaceUsersQuery.data as WorkspaceUser[]
        }
      : undefined;

  return {
    ...aggregateQueries<ProjectDetailReadModel>(queries, data),
    refetch: () => {
      void projectDetailQuery.refetch();
      void taskStatusesQuery.refetch();
      void workspaceUsersQuery.refetch();
    }
  };
}

export function useTaskActivityReadModelQuery(taskId: string | undefined) {
  const query = useQuery({
    enabled: Boolean(taskId),
    queryKey: taskId ? queryKeys.workspace.taskActivity(taskId) : queryKeys.workspace.taskActivity(""),
    queryFn: () => {
      if (!taskId) throw new Error("task_id_required");
      return fetchWorkspaceTaskActivity(taskId);
    }
  });

  return {
    data: query.data ? { activities: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}

export function useAgentCockpitReadModelQuery(context?: WorkspaceAgentContextInput | undefined) {
  const agentThreadQueryKey = hasWorkspaceAgentContext(context)
    ? queryKeys.workspace.workspaceAgentThreadContext(workspaceAgentContextKey(context))
    : queryKeys.workspace.workspaceAgentThread;
  const queries = useQueries({
    queries: [
      {
        queryKey: agentThreadQueryKey,
        queryFn: () => fetchWorkspaceAgentThread(context)
      },
      {
        queryKey: queryKeys.workspace.operationsCockpit,
        queryFn: fetchWorkspaceOperationsCockpit
      }
    ]
  });

  const [workspaceAgentThreadQuery, operationsCockpitQuery] = queries;
  const data =
    workspaceAgentThreadQuery.data && operationsCockpitQuery.data
      ? {
          workspaceAgentThread: workspaceAgentThreadQuery.data as WorkspaceAgentThread,
          operationsCockpit: operationsCockpitQuery.data as OperationsCockpitReadModel
        }
      : undefined;

  return aggregateQueries<AgentCockpitReadModel>(queries, data);
}

function workspaceAgentContextSearchParams(context?: WorkspaceAgentContextInput | undefined): string {
  if (!hasWorkspaceAgentContext(context)) return "";
  const searchParams = new URLSearchParams();
  appendWorkspaceAgentContextParam(searchParams, "dealId", context.dealId);
  appendWorkspaceAgentContextParam(searchParams, "projectId", context.projectId);
  appendWorkspaceAgentContextParam(searchParams, "taskId", context.taskId);
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function workspaceAgentContextKey(context: WorkspaceAgentContextInput): string {
  return [
    `deal:${context.dealId?.trim() ?? ""}`,
    `project:${context.projectId?.trim() ?? ""}`,
    `task:${context.taskId?.trim() ?? ""}`
  ].join("|");
}

function appendWorkspaceAgentContextParam(
  searchParams: URLSearchParams,
  key: keyof WorkspaceAgentContextInput,
  value: string | undefined
) {
  const trimmed = value?.trim();
  if (trimmed) searchParams.set(key, trimmed);
}

function hasWorkspaceAgentContext(
  context: WorkspaceAgentContextInput | undefined
): context is WorkspaceAgentContextInput {
  return Boolean(context?.dealId?.trim() || context?.projectId?.trim() || context?.taskId?.trim());
}

export function useAuditEventsReadModelQuery() {
  const query = useQuery({
    queryKey: queryKeys.tenant.currentAuditEvents,
    queryFn: fetchTenantCurrentAuditEvents
  });

  return {
    data: query.data ? { auditEvents: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}

export function useAdminUsersReadModelQuery() {
  const query = useQuery({
    queryKey: queryKeys.workspace.users,
    queryFn: fetchWorkspaceUsers
  });

  return {
    data: query.data ? { users: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}

export function useAdminAccessRolesReadModelQuery() {
  const query = useQuery({
    queryKey: queryKeys.workspace.accessRoles,
    queryFn: fetchWorkspaceAccessRoles
  });

  return {
    data: query.data ? { accessRoles: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}

export function useClientsReadModelQuery() {
  const query = useQuery({
    queryKey: queryKeys.workspace.clients,
    queryFn: fetchWorkspaceClients
  });

  return {
    data: query.data ? { clients: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}

export function useContactsReadModelQuery() {
  const query = useQuery({
    queryKey: queryKeys.workspace.contacts,
    queryFn: fetchWorkspaceContacts
  });

  return {
    data: query.data ? { contacts: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}

export function useProductsReadModelQuery() {
  const query = useQuery({
    queryKey: queryKeys.workspace.products,
    queryFn: fetchWorkspaceProducts
  });

  return {
    data: query.data ? { products: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}

export function getRuntimeTodayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function resolveRuntimeTaskReadModelInput({
  assigneeUserId,
  fromDate,
  toDate
}: RuntimeTaskReadModelInput): ScheduledTasksQueryInput {
  const today = getRuntimeTodayIsoDate();
  return {
    assigneeUserId,
    fromDate: fromDate ?? today,
    toDate: toDate ?? fromDate ?? today
  };
}

function aggregateQueries<TData>(
  queries: readonly UseQueryResult<unknown, unknown>[],
  data: TData | undefined
) {
  return {
    data,
    error: queries.find((query) => query.error)?.error ?? null,
    isPending: queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    refetchAll: () => {
      for (const query of queries) {
        void query.refetch();
      }
    }
  };
}

export function useMyWorkReadModelQueries(input: RuntimeTaskReadModelInput) {
  const scheduledInput = resolveRuntimeTaskReadModelInput(input);
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.workspace.myWork(scheduledInput.assigneeUserId),
        queryFn: fetchWorkspaceMyWorkTasks
      },
      {
        queryKey: queryKeys.tenant.currentScheduledTasks(
          scheduledInput.assigneeUserId,
          scheduledInput.fromDate,
          scheduledInput.toDate
        ),
        queryFn: () => fetchTenantCurrentScheduledTasks(scheduledInput)
      },
      {
        queryKey: queryKeys.workspace.taskStatuses,
        queryFn: fetchWorkspaceTaskStatuses
      },
      {
        queryKey: queryKeys.workspace.users,
        queryFn: fetchOptionalWorkspaceUsers
      }
    ]
  });

  const [tasksQuery, scheduledTasksQuery, taskStatusesQuery, workspaceUsersQuery] = queries;
  const data =
    tasksQuery.data && scheduledTasksQuery.data && taskStatusesQuery.data && workspaceUsersQuery.data
      ? {
          tasks: tasksQuery.data as Task[],
          scheduledTasks: scheduledTasksQuery.data as ScheduledTask[],
          taskStatuses: taskStatusesQuery.data as TaskStatus[],
          workspaceUsers: workspaceUsersQuery.data as WorkspaceUser[]
        }
      : undefined;

  return aggregateQueries<MyWorkReadModel>(queries, data);
}

export function useDashboardReadModelQueries(input: RuntimeTaskReadModelInput) {
  const scheduledInput = resolveRuntimeTaskReadModelInput(input);
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.workspace.projects,
        queryFn: fetchWorkspaceProjects
      },
      {
        queryKey: queryKeys.workspace.myWork(scheduledInput.assigneeUserId),
        queryFn: fetchWorkspaceMyWorkTasks
      },
      {
        queryKey: queryKeys.tenant.currentScheduledTasks(
          scheduledInput.assigneeUserId,
          scheduledInput.fromDate,
          scheduledInput.toDate
        ),
        queryFn: () => fetchTenantCurrentScheduledTasks(scheduledInput)
      },
      {
        queryKey: queryKeys.workspace.workspaceAgentThread,
        queryFn: () => fetchWorkspaceAgentThread()
      },
      {
        queryKey: queryKeys.workspace.operationsCockpit,
        queryFn: fetchWorkspaceOperationsCockpit
      }
    ]
  });

  const [
    projectsQuery,
    tasksQuery,
    scheduledTasksQuery,
    workspaceAgentThreadQuery,
    operationsCockpitQuery
  ] = queries;
  const data =
    projectsQuery.data &&
    tasksQuery.data &&
    scheduledTasksQuery.data &&
    workspaceAgentThreadQuery.data &&
    operationsCockpitQuery.data
      ? {
          projects: projectsQuery.data as Project[],
          tasks: tasksQuery.data as Task[],
          scheduledTasks: scheduledTasksQuery.data as ScheduledTask[],
          workspaceAgentThread: workspaceAgentThreadQuery.data as WorkspaceAgentThread,
          operationsCockpit: operationsCockpitQuery.data as OperationsCockpitReadModel
        }
      : undefined;

  return aggregateQueries<DashboardReadModel>(queries, data);
}

export function useDealsBoardReadModelQueries() {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.workspace.opportunities,
        queryFn: fetchWorkspaceOpportunities
      },
      {
        queryKey: queryKeys.workspace.dealStages,
        queryFn: fetchWorkspaceDealStages
      }
    ]
  });

  const [opportunitiesQuery, dealStagesQuery] = queries;
  const data =
    opportunitiesQuery.data && dealStagesQuery.data
      ? {
          opportunities: opportunitiesQuery.data,
          dealStages: dealStagesQuery.data
        }
      : undefined;

  return aggregateQueries<DealsBoardReadModel>(queries, data);
}

export function useDealDetailReadModelQuery(opportunityId: string | undefined) {
  const query = useQuery({
    enabled: Boolean(opportunityId),
    queryKey: opportunityId ? queryKeys.workspace.opportunity(opportunityId) : queryKeys.workspace.opportunity(""),
    queryFn: () => {
      if (!opportunityId) throw new Error("opportunity_id_required");
      return fetchWorkspaceOpportunity(opportunityId);
    }
  });

  return {
    data: query.data ? { opportunity: query.data } : undefined,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    }
  };
}
