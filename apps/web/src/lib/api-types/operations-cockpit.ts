import type { TenantId, UserId } from "./common";

export type OperationsCockpitSeverity = "critical" | "warning" | "info";

export type OperationsCockpitAttentionItem = {
  id: string;
  kind:
    | "project_overdue"
    | "task_overdue"
    | "task_waiting"
    | "critical_task"
    | "deal_ready_to_activate";
  severity: OperationsCockpitSeverity;
  title: string;
  reason: string;
  entity: {
    type: "project" | "task" | "deal";
    id: string;
    title: string;
  };
  projectId: string | null;
  ownerUserId: UserId | null;
  dueDate: string | null;
};

export type OperationsCockpitReadModel = {
  generatedAt: string;
  scope: {
    type: "workspace";
    tenantId: TenantId;
  };
  indicators: {
    activeProjects: number;
    overdueProjects: number;
    activeTasks: number;
    overdueTasks: number;
    waitingTasks: number;
    criticalTasks: number;
    openDeals: number;
    readyToActivateDeals: number;
  };
  attentionItems: OperationsCockpitAttentionItem[];
  workloadHints: {
    byPerson: Array<{
      userId: UserId;
      name: string;
      positionName: string | null;
      activeTaskCount: number;
      overdueTaskCount: number;
      criticalTaskCount: number;
      plannedWorkHours: number;
    }>;
  };
  pipelinePressure: {
    deals: Array<{
      id: string;
      title: string;
      clientName: string;
      status: string;
      probability: number;
      plannedFinish: string;
      plannedHours: number;
      contractValue: number;
      ownerUserId: UserId | null;
      feasibilityStatus: string | null;
    }>;
  };
  agentContext: {
    contextType: "operations_cockpit";
    focus: {
      type: "workspace";
      tenantId: TenantId;
    };
    generatedAt: string;
    sourceEntityTypes: Array<"Project" | "Task" | "Opportunity" | "TenantUser">;
    unavailableSources: Array<{
      source: string;
      reason: string;
    }>;
  };
};
