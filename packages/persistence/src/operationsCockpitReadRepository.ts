import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

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
const attentionLimit = 25;
const pipelinePressureLimit = 20;
const workloadHintsLimit = 20;

export function createOperationsCockpitReadRepository(
  db: KissPmDatabase
): OperationsCockpitReadRepository {
  return {
    async getOperationsCockpitReadModel(input) {
      const generatedAt = input.now.toISOString();
      const today = toIsoDate(input.now);
      const taskCategory = sql`coalesce(${taskStatuses.category}, ${tasks.status})`;
      const activeProjectStatus = inArray(projects.status, activeProjectStatuses);
      const activeTaskStatus = inArray(taskCategory, activeTaskCategories);
      const overdueProject = sql`${projects.plannedFinish}::date < ${today}::date`;
      const overdueTask = sql`${tasks.plannedFinish}::date < ${today}::date`;
      const baseActiveTaskScope = and(
        eq(tasks.tenantId, input.tenantId),
        isNull(tasks.archivedAt),
        activeProjectStatus,
        activeTaskStatus
      );

      const [
        projectIndicators,
        taskIndicators,
        projectAttentionRows,
        taskAttentionRows
      ] = await Promise.all([
        db
          .select({
            activeProjects: sql<number>`count(*) filter (where ${activeProjectStatus})::int`,
            overdueProjects: sql<number>`count(*) filter (where ${activeProjectStatus} and ${overdueProject})::int`
          })
          .from(projects)
          .where(eq(projects.tenantId, input.tenantId)),
        db
          .select({
            activeTasks: sql<number>`count(*)::int`,
            overdueTasks: sql<number>`count(*) filter (where ${overdueTask})::int`,
            waitingTasks: sql<number>`count(*) filter (where ${taskCategory} = 'waiting')::int`,
            criticalTasks: sql<number>`count(*) filter (where ${tasks.priority} = 'critical')::int`
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
          .where(baseActiveTaskScope),
        db
          .select()
          .from(projects)
          .where(
            and(eq(projects.tenantId, input.tenantId), activeProjectStatus, overdueProject)
          )
          .orderBy(asc(projects.plannedFinish), desc(projects.createdAt), desc(projects.id))
          .limit(attentionLimit),
        db
          .select({
            task: tasks,
            statusName: taskStatuses.name,
            statusCategory: taskStatuses.category
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
          .where(
            and(
              baseActiveTaskScope,
              sql`(${overdueTask} or ${taskCategory} = 'waiting' or ${tasks.priority} = 'critical')`
            )
          )
          .orderBy(asc(tasks.plannedFinish), desc(tasks.createdAt), desc(tasks.id))
          .limit(attentionLimit * 3)
      ]);

      const dealIndicators = input.includePipelinePressure
        ? (
            await db
              .select({
                openDeals: sql<number>`count(*)::int`,
                readyToActivateDeals: sql<number>`count(*) filter (where ${opportunities.status} = 'ready_to_activate')::int`
              })
              .from(opportunities)
              .where(
                and(
                  eq(opportunities.tenantId, input.tenantId),
                  notInArray(opportunities.status, finalOpportunityStatuses)
                )
              )
          )[0]
        : { openDeals: 0, readyToActivateDeals: 0 };

      const readyDealAttentionRows = input.includePipelinePressure
        ? await db
            .select()
            .from(opportunities)
            .where(
              and(
                eq(opportunities.tenantId, input.tenantId),
                eq(opportunities.status, "ready_to_activate")
              )
            )
            .orderBy(asc(opportunities.plannedFinish), desc(opportunities.updatedAt), desc(opportunities.id))
            .limit(attentionLimit)
        : [];
      const pipelinePressureRows = input.includePipelinePressure
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
            .limit(pipelinePressureLimit)
        : [];
      const workloadRows = input.includeWorkloadHints
        ? await db
            .select({
              userId: tasks.ownerUserId,
              name: tenantUsers.name,
              positionName: positions.name,
              activeTaskCount: sql<number>`count(*)::int`,
              overdueTaskCount: sql<number>`count(*) filter (where ${overdueTask})::int`,
              criticalTaskCount: sql<number>`count(*) filter (where ${tasks.priority} = 'critical')::int`,
              plannedWorkHours: sql<number>`coalesce(sum(${tasks.plannedWork}), 0)::int`
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
            .leftJoin(
              tenantUsers,
              and(
                eq(tenantUsers.tenantId, tasks.tenantId),
                eq(tenantUsers.id, tasks.ownerUserId)
              )
            )
            .leftJoin(
              positions,
              and(
                eq(positions.tenantId, tenantUsers.tenantId),
                eq(positions.id, tenantUsers.positionId)
              )
            )
            .where(baseActiveTaskScope)
            .groupBy(tasks.ownerUserId, tenantUsers.name, positions.name)
            .orderBy(
              desc(sql<number>`count(*) filter (where ${overdueTask})`),
              desc(sql<number>`count(*) filter (where ${tasks.priority} = 'critical')`),
              desc(sql<number>`coalesce(sum(${tasks.plannedWork}), 0)`),
              asc(tenantUsers.name)
            )
            .limit(workloadHintsLimit)
        : [];

      const attentionItems: OperationsCockpitAttentionItem[] = [
        ...projectAttentionRows.map((project) => ({
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
        ...taskAttentionRows
          .filter((row) => isBeforeDateOnly(row.task.plannedFinish, input.now))
          .map((row) => ({
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
        ...taskAttentionRows
          .filter((row) => (row.statusCategory ?? row.task.status) === "waiting")
          .map((row) => ({
            id: `task-waiting:${row.task.id}`,
            kind: "task_waiting" as const,
            severity: "warning" as const,
            title: row.task.title,
            reason: `Статус задачи: ${row.statusName ?? "ожидание"}.`,
            entity: { type: "task" as const, id: row.task.id, title: row.task.title },
            projectId: row.task.projectId,
            ownerUserId: row.task.ownerUserId,
            dueDate: toIsoDate(row.task.plannedFinish)
          })),
        ...taskAttentionRows
          .filter((row) => row.task.priority === "critical")
          .map((row) => ({
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
        ...readyDealAttentionRows.map((deal) => ({
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
        .slice(0, attentionLimit);

      return {
        generatedAt,
        scope: {
          type: "workspace",
          tenantId: input.tenantId
        },
        indicators: {
          activeProjects: projectIndicators[0]?.activeProjects ?? 0,
          overdueProjects: projectIndicators[0]?.overdueProjects ?? 0,
          activeTasks: taskIndicators[0]?.activeTasks ?? 0,
          overdueTasks: taskIndicators[0]?.overdueTasks ?? 0,
          waitingTasks: taskIndicators[0]?.waitingTasks ?? 0,
          criticalTasks: taskIndicators[0]?.criticalTasks ?? 0,
          openDeals: dealIndicators?.openDeals ?? 0,
          readyToActivateDeals: dealIndicators?.readyToActivateDeals ?? 0
        },
        attentionItems,
        workloadHints: {
          byPerson: input.includeWorkloadHints
            ? workloadRows.map((row) => ({
                userId: row.userId,
                name: row.name ?? row.userId,
                positionName: row.positionName ?? null,
                activeTaskCount: row.activeTaskCount,
                overdueTaskCount: row.overdueTaskCount,
                criticalTaskCount: row.criticalTaskCount,
                plannedWorkHours: row.plannedWorkHours
              }))
            : []
        },
        pipelinePressure: {
          deals: pipelinePressureRows.map((deal) => ({
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

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function isBeforeDateOnly(value: Date, now: Date): boolean {
  return toIsoDate(value) < toIsoDate(now);
}

export function isNonTerminalProjectStatus(status: string | null): boolean {
  return Boolean(status && activeProjectStatuses.includes(status));
}
