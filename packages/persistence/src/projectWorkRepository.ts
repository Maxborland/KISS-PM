import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  projects,
  taskActivities,
  taskAssignments,
  taskParticipants,
  taskStatuses,
  tasks
} from "./schema";

export type TaskStatusCategory =
  | "new"
  | "waiting"
  | "in_progress"
  | "review"
  | "done";
export type TaskStatus = TaskStatusCategory;
export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskSource = "manual";
export type TaskParticipantRole =
  | "executor"
  | "co_executor"
  | "requester"
  | "controller"
  | "approver"
  | "observer";

export type TaskStatusRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  category: TaskStatusCategory;
  sortOrder: number;
  status: "active" | "archived";
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskStatusInput = Omit<
  TaskStatusRecord,
  "createdAt" | "updatedAt" | "isSystem"
> & {
  isSystem?: boolean;
};

export type TaskParticipantRecord = {
  userId: UserId;
  role: TaskParticipantRole;
};

export type TaskRecord = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  stageId: string | null;
  title: string;
  description: string | null;
  status: TaskStatusCategory;
  statusId: string;
  statusName: string;
  statusCategory: TaskStatusCategory;
  priority: TaskPriority;
  requesterUserId: UserId;
  ownerUserId: UserId;
  plannedStart: Date;
  plannedFinish: Date;
  durationWorkingDays: number;
  plannedWork: number;
  actualWork: number;
  progress: number;
  requiresAcceptance: boolean;
  source: TaskSource;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  participants: TaskParticipantRecord[];
};

export type TaskInput = Omit<TaskRecord, "createdAt" | "updatedAt" | "archivedAt">;

export type TaskMetadataInput = {
  tenantId: TenantId;
  taskId: string;
  description: string | null;
  priority: TaskPriority;
  requesterUserId: UserId;
  ownerUserId: UserId;
  requiresAcceptance: boolean;
  participants: TaskParticipantRecord[];
};

export type TaskStatusUpdateInput = {
  tenantId: TenantId;
  projectId: string;
  taskId: string;
  expectedStatus: TaskStatusCategory;
  status: TaskStatusCategory;
  statusId: string;
  progress: number;
};

export type TaskActivityRecord = {
  id: string;
  tenantId: TenantId;
  taskId: string;
  type: "comment" | "file" | "system";
  body: string | null;
  title: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  authorUserId: UserId;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskActivityInput = Omit<
  TaskActivityRecord,
  "createdAt" | "updatedAt"
>;

export type ScheduledTaskRecord = {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  plannedStart: Date;
  plannedFinish: Date;
  workMinutes: number;
  createdAt: Date;
  statusId: string;
};

export type ProjectWorkRepository = {
  listScheduledTasks(input: {
    tenantId: TenantId;
    assigneeUserId: UserId;
    fromDate: string;
    toDate: string;
    limit?: number;
  }): Promise<ScheduledTaskRecord[]>;
  listTaskStatuses(tenantId: TenantId): Promise<TaskStatusRecord[]>;
  createTaskStatus(input: TaskStatusInput): Promise<TaskStatusRecord>;
  updateTaskStatusDefinition(input: TaskStatusInput): Promise<TaskStatusRecord>;
  archiveTaskStatus(
    tenantId: TenantId,
    statusId: string
  ): Promise<TaskStatusRecord | undefined>;
  listProjectTasks(tenantId: TenantId, projectId: string): Promise<TaskRecord[]>;
  listMyWorkTasks(tenantId: TenantId, userId: UserId): Promise<TaskRecord[]>;
  findTaskById(tenantId: TenantId, taskId: string): Promise<TaskRecord | undefined>;
  findTaskByIdIncludingArchived(
    tenantId: TenantId,
    taskId: string
  ): Promise<TaskRecord | undefined>;
  createTask(input: TaskInput): Promise<TaskRecord>;
  updateTask(input: TaskInput): Promise<TaskRecord | undefined>;
  updateTaskMetadata(input: TaskMetadataInput): Promise<TaskRecord | undefined>;
  archiveTask(tenantId: TenantId, taskId: string): Promise<TaskRecord | undefined>;
  updateTaskStatus(input: TaskStatusUpdateInput): Promise<TaskRecord | undefined>;
  listTaskActivities(tenantId: TenantId, taskId: string): Promise<TaskActivityRecord[]>;
  createTaskActivity(input: TaskActivityInput): Promise<TaskActivityRecord>;
};

export function createProjectWorkRepository(db: KissPmDatabase): ProjectWorkRepository {
  async function listTaskParticipants(
    tenantId: TenantId,
    taskIds: readonly string[]
  ): Promise<Map<string, TaskParticipantRecord[]>> {
    const participantsByTask = new Map<string, TaskParticipantRecord[]>();
    if (taskIds.length === 0) return participantsByTask;

    const rows = await db
      .select()
      .from(taskParticipants)
      .where(
        and(
          eq(taskParticipants.tenantId, tenantId),
          inArray(taskParticipants.taskId, [...taskIds])
        )
      );

    for (const row of rows) {
      const participants = participantsByTask.get(row.taskId) ?? [];
      participants.push({
        userId: row.userId,
        role: row.role as TaskParticipantRole
      });
      participantsByTask.set(row.taskId, participants);
    }

    return participantsByTask;
  }

  async function hydrateTasks(
    tenantId: TenantId,
    rows: Array<{
      task: typeof tasks.$inferSelect;
      status: typeof taskStatuses.$inferSelect | null;
    }>
  ): Promise<TaskRecord[]> {
    const participantsByTask = await listTaskParticipants(
      tenantId,
      rows.map((row) => row.task.id)
    );

    return rows.map((row) =>
      mapTaskRecord(
        row.task,
        row.status,
        participantsByTask.get(row.task.id) ?? []
      )
    );
  }

  const listTaskRows = (tenantId: TenantId) =>
    db
      .select({ task: tasks, status: taskStatuses })
      .from(tasks)
      .leftJoin(
        taskStatuses,
        and(
          eq(taskStatuses.tenantId, tasks.tenantId),
          eq(taskStatuses.id, tasks.statusId)
        )
      )
      .where(and(eq(tasks.tenantId, tenantId), isNull(tasks.archivedAt)));

  return {
    async listScheduledTasks(input) {
      const limit = input.limit ?? 50;
      const rangeStart = new Date(`${input.fromDate}T00:00:00.000Z`);
      const rangeFinish = new Date(`${input.toDate}T23:59:59.999Z`);
      const assignmentRows = await db
        .select({ taskId: taskAssignments.taskId })
        .from(taskAssignments)
        .where(
          and(
            eq(taskAssignments.tenantId, input.tenantId),
            eq(taskAssignments.resourceId, input.assigneeUserId)
          )
        );
      const assignedTaskIds = [...new Set(assignmentRows.map((row) => row.taskId))];
      const rows = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          projectId: tasks.projectId,
          projectTitle: projects.title,
          plannedStart: tasks.plannedStart,
          plannedFinish: tasks.plannedFinish,
          workMinutes: tasks.workMinutes,
          createdAt: tasks.createdAt,
          statusId: tasks.statusId
        })
        .from(tasks)
        .innerJoin(
          projects,
          and(eq(projects.tenantId, tasks.tenantId), eq(projects.id, tasks.projectId))
        )
        .where(
          and(
            eq(tasks.tenantId, input.tenantId),
            isNull(tasks.archivedAt),
            lte(tasks.plannedStart, rangeFinish),
            gte(tasks.plannedFinish, rangeStart),
            or(
              eq(tasks.ownerUserId, input.assigneeUserId),
              assignedTaskIds.length > 0 ? inArray(tasks.id, assignedTaskIds) : sql`false`
            )
          )
        )
        .orderBy(asc(tasks.createdAt), asc(tasks.id))
        .limit(limit);

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        projectId: row.projectId,
        projectTitle: row.projectTitle,
        plannedStart: row.plannedStart,
        plannedFinish: row.plannedFinish,
        workMinutes: row.workMinutes ?? 0,
        createdAt: row.createdAt,
        statusId: row.statusId
      }));
    },
    async listTaskStatuses(tenantId) {
      const rows = await db
        .select()
        .from(taskStatuses)
        .where(eq(taskStatuses.tenantId, tenantId))
        .orderBy(asc(taskStatuses.sortOrder), asc(taskStatuses.id));

      return rows.map(mapTaskStatusRecord);
    },
    async createTaskStatus(input) {
      const now = new Date();
      const [row] = await db
        .insert(taskStatuses)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          name: input.name,
          category: input.category,
          sortOrder: input.sortOrder,
          status: input.status,
          isSystem: input.isSystem ?? false,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      if (!row) throw new Error("Task status insert returned no row");
      return mapTaskStatusRecord(row);
    },
    async updateTaskStatusDefinition(input) {
      const [row] = await db
        .update(taskStatuses)
        .set({
          name: input.name,
          category: input.category,
          sortOrder: input.sortOrder,
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(eq(taskStatuses.tenantId, input.tenantId), eq(taskStatuses.id, input.id))
        )
        .returning();

      if (!row) throw new Error("Task status update returned no row");
      return mapTaskStatusRecord(row);
    },
    async archiveTaskStatus(tenantId, statusId) {
      const [row] = await db
        .update(taskStatuses)
        .set({
          status: "archived",
          updatedAt: new Date()
        })
        .where(
          and(
            eq(taskStatuses.tenantId, tenantId),
            eq(taskStatuses.id, statusId),
            eq(taskStatuses.isSystem, false)
          )
        )
        .returning();

      return row ? mapTaskStatusRecord(row) : undefined;
    },
    async listProjectTasks(tenantId, projectId) {
      const rows = await db
        .select({ task: tasks, status: taskStatuses })
        .from(tasks)
        .leftJoin(
          taskStatuses,
          and(
            eq(taskStatuses.tenantId, tasks.tenantId),
            eq(taskStatuses.id, tasks.statusId)
          )
        )
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.projectId, projectId),
            isNull(tasks.archivedAt)
          )
        )
        .orderBy(desc(tasks.createdAt), desc(tasks.id));

      return hydrateTasks(tenantId, rows);
    },
    async listMyWorkTasks(tenantId, userId) {
      // «Мои задачи» = задачи, где пользователь ИСПОЛНИТЕЛЬ (executor/co_executor).
      // Роль requester (постановщик) сюда не входит — иначе раздел показывал чужие
      // задачи под заголовком «Задачи, где вы исполнитель» (G2-07).
      const participantRows = await db
        .select({ taskId: taskParticipants.taskId })
        .from(taskParticipants)
        .where(
          and(
            eq(taskParticipants.tenantId, tenantId),
            eq(taskParticipants.userId, userId),
            inArray(taskParticipants.role, ["executor", "co_executor"])
          )
        );
      const taskIds = [...new Set(participantRows.map((row) => row.taskId))];
      if (taskIds.length === 0) return [];

      const rows = await db
        .select({ task: tasks, status: taskStatuses })
        .from(tasks)
        .leftJoin(
          taskStatuses,
          and(
            eq(taskStatuses.tenantId, tasks.tenantId),
            eq(taskStatuses.id, tasks.statusId)
          )
        )
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            inArray(tasks.id, taskIds),
            isNull(tasks.archivedAt)
          )
        )
        .orderBy(desc(tasks.createdAt), desc(tasks.id));

      return hydrateTasks(tenantId, rows);
    },
    async findTaskById(tenantId, taskId) {
      const rows = await listTaskRows(tenantId);
      const task = rows.find((row) => row.task.id === taskId);
      if (!task) return undefined;
      return (await hydrateTasks(tenantId, [task]))[0];
    },
    async findTaskByIdIncludingArchived(tenantId, taskId) {
      const [row] = await db
        .select({ task: tasks, status: taskStatuses })
        .from(tasks)
        .leftJoin(
          taskStatuses,
          and(
            eq(taskStatuses.tenantId, tasks.tenantId),
            eq(taskStatuses.id, tasks.statusId)
          )
        )
        .where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId)))
        .limit(1);

      if (!row) return undefined;
      return (await hydrateTasks(tenantId, [row]))[0];
    },
    async createTask(input) {
      return db.transaction(async (transaction) => {
        const now = new Date();
        const [row] = await transaction
          .insert(tasks)
          .values({
            id: input.id,
            tenantId: input.tenantId,
            projectId: input.projectId,
            stageId: input.stageId,
            title: input.title,
            description: input.description,
            status: input.status,
            statusId: input.statusId,
            priority: input.priority,
            requesterUserId: input.requesterUserId,
            ownerUserId: input.ownerUserId,
            plannedStart: input.plannedStart,
            plannedFinish: input.plannedFinish,
            durationWorkingDays: input.durationWorkingDays,
            plannedWork: input.plannedWork,
            actualWork: input.actualWork,
            progress: input.progress,
            requiresAcceptance: input.requiresAcceptance,
            source: input.source,
            createdAt: now,
            updatedAt: now
          })
          .returning();

        if (!row) throw new Error("Task insert returned no row");

        await transaction.insert(taskParticipants).values(
          input.participants.map((participant) => ({
            tenantId: input.tenantId,
            taskId: input.id,
            userId: participant.userId,
            role: participant.role
          }))
        );

        return mapTaskRecord(row, null, input.participants);
      });
    },
    async updateTask(input) {
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(tasks)
          .set({
            title: input.title,
            description: input.description,
            status: input.status,
            statusId: input.statusId,
            priority: input.priority,
            requesterUserId: input.requesterUserId,
            ownerUserId: input.ownerUserId,
            plannedStart: input.plannedStart,
            plannedFinish: input.plannedFinish,
            durationWorkingDays: input.durationWorkingDays,
            plannedWork: input.plannedWork,
            actualWork: input.actualWork,
            progress: input.progress,
            requiresAcceptance: input.requiresAcceptance,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(tasks.tenantId, input.tenantId),
              eq(tasks.id, input.id),
              isNull(tasks.archivedAt)
            )
          )
          .returning();

        if (!row) return undefined;

        await transaction
          .delete(taskParticipants)
          .where(
            and(
              eq(taskParticipants.tenantId, input.tenantId),
              eq(taskParticipants.taskId, input.id)
            )
          );
        await transaction.insert(taskParticipants).values(
          input.participants.map((participant) => ({
            tenantId: input.tenantId,
            taskId: input.id,
            userId: participant.userId,
            role: participant.role
          }))
        );

        return mapTaskRecord(row, null, input.participants);
      });
    },
    async updateTaskMetadata(input) {
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(tasks)
          .set({
            description: input.description,
            priority: input.priority,
            requesterUserId: input.requesterUserId,
            ownerUserId: input.ownerUserId,
            requiresAcceptance: input.requiresAcceptance,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(tasks.tenantId, input.tenantId),
              eq(tasks.id, input.taskId),
              isNull(tasks.archivedAt)
            )
          )
          .returning();

        if (!row) return undefined;

        await transaction
          .delete(taskParticipants)
          .where(
            and(
              eq(taskParticipants.tenantId, input.tenantId),
              eq(taskParticipants.taskId, input.taskId)
            )
          );
        await transaction.insert(taskParticipants).values(
          input.participants.map((participant) => ({
            tenantId: input.tenantId,
            taskId: input.taskId,
            userId: participant.userId,
            role: participant.role
          }))
        );

        return mapTaskRecord(row, null, input.participants);
      });
    },
    async archiveTask(tenantId, taskId) {
      const [row] = await db
        .update(tasks)
        .set({
          archivedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId)))
        .returning();

      if (!row) return undefined;
      const participantsByTask = await listTaskParticipants(tenantId, [taskId]);
      return mapTaskRecord(row, null, participantsByTask.get(taskId) ?? []);
    },
    async updateTaskStatus(input) {
      const [row] = await db
        .update(tasks)
        .set({
          status: input.status,
          statusId: input.statusId,
          progress: input.progress,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(tasks.tenantId, input.tenantId),
            eq(tasks.projectId, input.projectId),
            eq(tasks.id, input.taskId),
            eq(tasks.status, input.expectedStatus),
            isNull(tasks.archivedAt),
            sql`exists (
              select 1
              from ${projects}
              where ${projects.tenantId} = ${input.tenantId}
                and ${projects.id} = ${input.projectId}
                and ${projects.status} = 'active'
            )`
          )
        )
        .returning();

      if (!row) return undefined;

      const participantsByTask = await listTaskParticipants(input.tenantId, [input.taskId]);
      return mapTaskRecord(row, null, participantsByTask.get(input.taskId) ?? []);
    },
    async listTaskActivities(tenantId, taskId) {
      const rows = await db
        .select()
        .from(taskActivities)
        .where(
          and(eq(taskActivities.tenantId, tenantId), eq(taskActivities.taskId, taskId))
        )
        .orderBy(asc(taskActivities.createdAt), asc(taskActivities.id));

      return rows.map(mapTaskActivityRecord);
    },
    async createTaskActivity(input) {
      const now = new Date();
      const [row] = await db
        .insert(taskActivities)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          taskId: input.taskId,
          type: input.type,
          body: input.body,
          title: input.title,
          fileUrl: input.fileUrl,
          fileSizeBytes: input.fileSizeBytes,
          mimeType: input.mimeType,
          authorUserId: input.authorUserId,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      if (!row) throw new Error("Task activity insert returned no row");
      return mapTaskActivityRecord(row);
    }
  };
}

function mapTaskStatusRecord(
  row: typeof taskStatuses.$inferSelect
): TaskStatusRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    category: row.category as TaskStatusCategory,
    sortOrder: row.sortOrder,
    status: row.status as TaskStatusRecord["status"],
    isSystem: row.isSystem,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapTaskRecord(
  row: typeof tasks.$inferSelect,
  status: typeof taskStatuses.$inferSelect | null,
  participants: TaskParticipantRecord[]
): TaskRecord {
  const statusCategory = (status?.category ?? row.status) as TaskStatusCategory;
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    stageId: row.stageId,
    title: row.title,
    description: row.description,
    status: statusCategory,
    statusId: row.statusId,
    statusName: status?.name ?? row.status,
    statusCategory,
    priority: row.priority as TaskPriority,
    requesterUserId: row.requesterUserId,
    ownerUserId: row.ownerUserId,
    plannedStart: row.plannedStart,
    plannedFinish: row.plannedFinish,
    durationWorkingDays: row.durationWorkingDays,
    plannedWork: row.plannedWork,
    actualWork: row.actualWork,
    progress: row.progress,
    requiresAcceptance: row.requiresAcceptance,
    source: row.source as TaskSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    participants
  };
}

function mapTaskActivityRecord(
  row: typeof taskActivities.$inferSelect
): TaskActivityRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    taskId: row.taskId,
    type: row.type as TaskActivityRecord["type"],
    body: row.body,
    title: row.title,
    fileUrl: row.fileUrl,
    fileSizeBytes: row.fileSizeBytes,
    mimeType: row.mimeType,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
