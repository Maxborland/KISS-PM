import { and, desc, eq, isNull, notInArray } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  opportunities,
  positions,
  projects,
  taskStatuses,
  tasks,
  tenantUsers
} from "./schema";

export type OperationsCockpitSeverity = "critical" | "warning" | "info";

export type OperationsCockpitUnavailableSource = {
  source: string;
  reason: string;
};

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

export type OperationsCockpitPersonWorkloadHint = {
  userId: UserId;
  name: string;
  positionName: string | null;
  activeTaskCount: number;
  overdueTaskCount: number;
  criticalTaskCount: number;
  plannedWorkHours: number;
};

export type OperationsCockpitDealPressureItem = {
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
    byPerson: OperationsCockpitPersonWorkloadHint[];
  };
  pipelinePressure: {
    deals: OperationsCockpitDealPressureItem[];
  };
  agentContext: {
    contextType: "operations_cockpit";
    focus: {
      type: "workspace";
      tenantId: TenantId;
    };
    generatedAt: string;
    sourceEntityTypes: Array<"Project" | "Task" | "Opportunity" | "TenantUser">;
    unavailableSources: OperationsCockpitUnavailableSource[];
  };
};

export type OperationsCockpitReadRepository = {
  getOperationsCockpitReadModel(input: {
    tenantId: TenantId;
    now: Date;
    includePipelinePressure: boolean;
    includeWorkloadHints: boolean;
  }): Promise<OperationsCockpitReadModel>;
};

const finalOpportunityStatuses = ["won_closed", "lost_rejected"];
const activeProjectStatuses = ["active", "draft", "paused"];
const activeTaskCategories = ["new", "waiting", "in_progress", "review"];

export function createOperationsCockpitReadRepository(
  db: KissPmDatabase
): OperationsCockpitReadRepository {
  return {
    async getOperationsCockpitReadModel(input) {
      const [projectRows, taskRows] = await Promise.all([
        db
          .select()
          .from(projects)
          .where(eq(projects.tenantId, input.tenantId))
          .orderBy(desc(projects.activatedAt), desc(projects.createdAt), desc(projects.id)),
        db
          .select({
            task: tasks,
            status: taskStatuses,
            projectTitle: projects.title,
            projectStatus: projects.status
          })
          .from(tasks)
          .leftJoin(
            taskStatuses,
            and(
              eq(taskStatuses.tenantId, tasks.tenantId),
              eq(taskStatuses.id, tasks.statusId)
            )
          )
          .leftJoin(
            projects,
            and(eq(projects.tenantId, tasks.tenantId), eq(projects.id, tasks.projectId))
          )
          .where(and(eq(tasks.tenantId, input.tenantId), isNull(tasks.archivedAt)))
          .orderBy(desc(tasks.plannedFinish), desc(tasks.createdAt), desc(tasks.id)),
      ]);
      const userRows = input.includeWorkloadHints
        ? await db
            .select({
              user: tenantUsers,
              positionName: positions.name
            })
            .from(tenantUsers)
            .leftJoin(
              positions,
              and(
                eq(positions.tenantId, tenantUsers.tenantId),
                eq(positions.id, tenantUsers.positionId)
              )
            )
            .where(eq(tenantUsers.tenantId, input.tenantId))
        : [];
      const opportunityRows = input.includePipelinePressure
        ? await db
            .select()
            .from(opportunities)
            .where(
              and(
                eq(opportunities.tenantId, input.tenantId),
                notInArray(opportunities.status, finalOpportunityStatuses)
              )
            )
            .orderBy(desc(opportunities.probability), desc(opportunities.updatedAt), desc(opportunities.id))
        : [];

      const generatedAt = input.now.toISOString();
      const usersById = new Map(userRows.map((row) => [row.user.id, row]));
      const activeProjects = projectRows.filter((project) =>
        activeProjectStatuses.includes(project.status)
      );
      const activeTasks = taskRows.filter((row) => {
        const category = row.status?.category ?? row.task.status;
        return activeTaskCategories.includes(category) && isNonTerminalProjectStatus(row.projectStatus);
      });
      const overdueProjects = activeProjects.filter(
        (project) => isBeforeDateOnly(project.plannedFinish, input.now)
      );
      const overdueTasks = activeTasks.filter(
        (row) => isBeforeDateOnly(row.task.plannedFinish, input.now)
      );
      const waitingTasks = activeTasks.filter((row) => {
        const category = row.status?.category ?? row.task.status;
        return category === "waiting";
      });
      const criticalTasks = activeTasks.filter((row) => row.task.priority === "critical");
      const readyToActivateDeals = opportunityRows.filter(
        (opportunity) => opportunity.status === "ready_to_activate"
      );

      const workloadByUser = new Map<UserId, OperationsCockpitPersonWorkloadHint>();
      for (const row of input.includeWorkloadHints ? activeTasks : []) {
        const owner = usersById.get(row.task.ownerUserId);
        const current =
          workloadByUser.get(row.task.ownerUserId) ??
          {
            userId: row.task.ownerUserId,
            name: owner?.user.name ?? row.task.ownerUserId,
            positionName: owner?.positionName ?? null,
            activeTaskCount: 0,
            overdueTaskCount: 0,
            criticalTaskCount: 0,
            plannedWorkHours: 0
          };

        current.activeTaskCount += 1;
        current.plannedWorkHours += row.task.plannedWork;
        if (isBeforeDateOnly(row.task.plannedFinish, input.now)) {
          current.overdueTaskCount += 1;
        }
        if (row.task.priority === "critical") current.criticalTaskCount += 1;
        workloadByUser.set(row.task.ownerUserId, current);
      }

      const attentionItems: OperationsCockpitAttentionItem[] = [
        ...overdueProjects.map((project) => ({
          id: `project-overdue:${project.id}`,
          kind: "project_overdue" as const,
          severity: "critical" as const,
          title: project.title,
          reason: "Плановая дата завершения проекта уже прошла.",
          entity: { type: "project" as const, id: project.id, title: project.title },
          projectId: project.id,
          ownerUserId: null,
          dueDate: toIsoDate(project.plannedFinish)
        })),
        ...overdueTasks.map((row) => ({
          id: `task-overdue:${row.task.id}`,
          kind: "task_overdue" as const,
          severity: "critical" as const,
          title: row.task.title,
          reason: "Плановая дата завершения задачи уже прошла.",
          entity: { type: "task" as const, id: row.task.id, title: row.task.title },
          projectId: row.task.projectId,
          ownerUserId: row.task.ownerUserId,
          dueDate: toIsoDate(row.task.plannedFinish)
        })),
        ...waitingTasks.map((row) => ({
          id: `task-waiting:${row.task.id}`,
          kind: "task_waiting" as const,
          severity: "warning" as const,
          title: row.task.title,
          reason: `Статус задачи: ${row.status?.name ?? "ожидание"}.`,
          entity: { type: "task" as const, id: row.task.id, title: row.task.title },
          projectId: row.task.projectId,
          ownerUserId: row.task.ownerUserId,
          dueDate: toIsoDate(row.task.plannedFinish)
        })),
        ...criticalTasks.map((row) => ({
          id: `task-critical:${row.task.id}`,
          kind: "critical_task" as const,
          severity: "warning" as const,
          title: row.task.title,
          reason: "Задача отмечена критическим приоритетом.",
          entity: { type: "task" as const, id: row.task.id, title: row.task.title },
          projectId: row.task.projectId,
          ownerUserId: row.task.ownerUserId,
          dueDate: toIsoDate(row.task.plannedFinish)
        })),
        ...readyToActivateDeals.map((deal) => ({
          id: `deal-ready:${deal.id}`,
          kind: "deal_ready_to_activate" as const,
          severity: "info" as const,
          title: deal.title,
          reason: "Сделка готова к активации проекта.",
          entity: { type: "deal" as const, id: deal.id, title: deal.title },
          projectId: null,
          ownerUserId: deal.ownerUserId,
          dueDate: toIsoDate(deal.plannedFinish)
        }))
      ]
        .sort(compareAttentionItems)
        .slice(0, 25);

      return {
        generatedAt,
        scope: {
          type: "workspace",
          tenantId: input.tenantId
        },
        indicators: {
          activeProjects: activeProjects.length,
          overdueProjects: overdueProjects.length,
          activeTasks: activeTasks.length,
          overdueTasks: overdueTasks.length,
          waitingTasks: waitingTasks.length,
          criticalTasks: criticalTasks.length,
          openDeals: opportunityRows.length,
          readyToActivateDeals: readyToActivateDeals.length
        },
        attentionItems,
        workloadHints: {
          byPerson: input.includeWorkloadHints
            ? [...workloadByUser.values()].sort(compareWorkloadHints).slice(0, 20)
            : []
        },
        pipelinePressure: {
          deals: opportunityRows.slice(0, 20).map((deal) => ({
            id: deal.id,
            title: deal.title,
            clientName: deal.clientName,
            status: deal.status,
            probability: deal.probability,
            plannedFinish: toIsoDate(deal.plannedFinish),
            plannedHours: deal.plannedHours,
            contractValue: deal.contractValue,
            ownerUserId: deal.ownerUserId,
            feasibilityStatus: deal.feasibilityStatus
          }))
        },
        agentContext: {
          contextType: "operations_cockpit",
          focus: {
            type: "workspace",
            tenantId: input.tenantId
          },
          generatedAt,
          sourceEntityTypes: ["Project", "Task", "Opportunity", "TenantUser"],
          unavailableSources: [
            ...(!input.includePipelinePressure
              ? [
                  {
                    source: "opportunity_pipeline",
                    reason: "У пользователя нет права читать сделки; блок pipeline скрыт."
                  }
                ]
              : []),
            ...(!input.includeWorkloadHints
              ? [
                  {
                    source: "resource_workload",
                    reason: "У пользователя нет права читать загрузку ресурсов; персональные workload hints скрыты."
                  }
                ]
              : []),
            {
              source: "explicit_blocker_flag",
              reason: "В текущей модели задач нет отдельного признака blocker; доступен только статус ожидания."
            },
            {
              source: "capacity_overallocation",
              reason: "Workspace-level capacity pressure не смоделирован в этом read endpoint."
            }
          ]
        }
      };
    }
  };
}

function compareAttentionItems(
  left: OperationsCockpitAttentionItem,
  right: OperationsCockpitAttentionItem
): number {
  const severityOrder: Record<OperationsCockpitSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2
  };
  const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
  if (severityDiff !== 0) return severityDiff;
  return (left.dueDate ?? "").localeCompare(right.dueDate ?? "");
}

function compareWorkloadHints(
  left: OperationsCockpitPersonWorkloadHint,
  right: OperationsCockpitPersonWorkloadHint
): number {
  return (
    right.overdueTaskCount - left.overdueTaskCount ||
    right.criticalTaskCount - left.criticalTaskCount ||
    right.plannedWorkHours - left.plannedWorkHours ||
    left.name.localeCompare(right.name)
  );
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function isBeforeDateOnly(value: Date, now: Date): boolean {
  return toIsoDate(value) < toIsoDate(now);
}

export function isNonTerminalProjectStatus(status: string | null): boolean {
  return Boolean(status && activeProjectStatuses.includes(status));
}
