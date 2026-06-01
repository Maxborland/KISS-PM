"use client";

import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type {
  DealStage,
  OperationsCockpitReadModel,
  Opportunity,
  Project,
  ScheduledTask,
  Task
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
};

export type DealsBoardReadModel = {
  opportunities: Opportunity[];
  dealStages: DealStage[];
};

export type MyWorkReadModel = {
  tasks: Task[];
  scheduledTasks: ScheduledTask[];
};

export type DashboardReadModel = {
  projects: Project[];
  tasks: Task[];
  scheduledTasks: ScheduledTask[];
  workspaceAgentThread: WorkspaceAgentThread;
};

export type AgentCockpitReadModel = {
  operationsCockpit: OperationsCockpitReadModel;
  workspaceAgentThread: WorkspaceAgentThread;
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

export type WorkspaceAgentMessage = {
  id: string;
  authorUserId: string;
  body: string;
  context: WorkspaceAgentThreadContext;
  createdAt: string;
};

export type WorkspaceAgentProposalStatus = "proposed" | "applying" | "applied" | "rejected";

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
  createdAt: string;
  resolvedAt: string | null;
};

export type WorkspaceAgentThread = {
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

export async function fetchWorkspaceProjects(): Promise<Project[]> {
  const response = await apiFetch<ListResponse<"projects", Project>>("/api/workspace/projects", {
    method: "GET"
  });
  return response.projects;
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

export async function fetchWorkspaceDealStages(): Promise<DealStage[]> {
  const response = await apiFetch<ListResponse<"dealStages", DealStage>>("/api/workspace/deal-stages", {
    method: "GET"
  });
  return response.dealStages;
}

export async function fetchWorkspaceAgentThread(): Promise<WorkspaceAgentThread> {
  return apiFetch<WorkspaceAgentThread>("/api/workspace/agent-thread", { method: "GET" });
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

export async function postWorkspaceAgentMessage(body: string): Promise<WorkspaceAgentThread> {
  return apiFetch<WorkspaceAgentThread>("/api/workspace/agent-thread/messages", {
    method: "POST",
    json: body
  });
}

export async function confirmWorkspaceAgentProposal(input: {
  proposalId: string;
  decision: "apply" | "reject";
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
  return useQuery({
    queryKey: queryKeys.workspace.projects,
    queryFn: fetchWorkspaceProjects,
    select: (projects): ProjectsListReadModel => ({ projects })
  });
}

export function useAgentCockpitReadModelQuery() {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.workspace.workspaceAgentThread,
        queryFn: fetchWorkspaceAgentThread
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
      }
    ]
  });

  const [tasksQuery, scheduledTasksQuery] = queries;
  const data =
    tasksQuery.data && scheduledTasksQuery.data
      ? {
          tasks: tasksQuery.data as Task[],
          scheduledTasks: scheduledTasksQuery.data as ScheduledTask[]
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
        queryFn: fetchWorkspaceAgentThread
      }
    ]
  });

  const [projectsQuery, tasksQuery, scheduledTasksQuery, workspaceAgentThreadQuery] = queries;
  const data =
    projectsQuery.data && tasksQuery.data && scheduledTasksQuery.data && workspaceAgentThreadQuery.data
      ? {
          projects: projectsQuery.data as Project[],
          tasks: tasksQuery.data as Task[],
          scheduledTasks: scheduledTasksQuery.data as ScheduledTask[],
          workspaceAgentThread: workspaceAgentThreadQuery.data as WorkspaceAgentThread
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
