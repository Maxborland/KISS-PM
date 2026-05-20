import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { projects, taskParticipants, tasks } from "./schema";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskSource = "manual";
export type TaskParticipantRole =
  | "executor"
  | "co_executor"
  | "requester"
  | "controller"
  | "approver"
  | "observer";

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
  status: TaskStatus;
  priority: TaskPriority;
  plannedStart: Date;
  plannedFinish: Date;
  plannedWork: number;
  actualWork: number;
  progress: number;
  source: TaskSource;
  createdAt: Date;
  updatedAt: Date;
  participants: TaskParticipantRecord[];
};

export type TaskInput = Omit<TaskRecord, "createdAt" | "updatedAt">;

export type TaskStatusUpdateInput = {
  tenantId: TenantId;
  projectId: string;
  taskId: string;
  expectedStatus: TaskStatus;
  status: TaskStatus;
  progress: number;
};

export type ProjectWorkRepository = {
  listProjectTasks(tenantId: TenantId, projectId: string): Promise<TaskRecord[]>;
  listMyWorkTasks(tenantId: TenantId, userId: UserId): Promise<TaskRecord[]>;
  createTask(input: TaskInput): Promise<TaskRecord>;
  updateTaskStatus(input: TaskStatusUpdateInput): Promise<TaskRecord | undefined>;
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
    rows: Array<typeof tasks.$inferSelect>
  ): Promise<TaskRecord[]> {
    const participantsByTask = await listTaskParticipants(
      tenantId,
      rows.map((row) => row.id)
    );

    return rows.map((row) =>
      mapTaskRecord(row, participantsByTask.get(row.id) ?? [])
    );
  }

  return {
    async listProjectTasks(tenantId, projectId) {
      const rows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, projectId)))
        .orderBy(desc(tasks.createdAt), desc(tasks.id));

      return hydrateTasks(tenantId, rows);
    },
    async listMyWorkTasks(tenantId, userId) {
      const participantRows = await db
        .select({ taskId: taskParticipants.taskId })
        .from(taskParticipants)
        .where(
          and(
            eq(taskParticipants.tenantId, tenantId),
            eq(taskParticipants.userId, userId)
          )
        );
      const taskIds = [...new Set(participantRows.map((row) => row.taskId))];
      if (taskIds.length === 0) return [];

      const rows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.tenantId, tenantId), inArray(tasks.id, taskIds)))
        .orderBy(desc(tasks.createdAt), desc(tasks.id));

      return hydrateTasks(tenantId, rows);
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
            priority: input.priority,
            plannedStart: input.plannedStart,
            plannedFinish: input.plannedFinish,
            plannedWork: input.plannedWork,
            actualWork: input.actualWork,
            progress: input.progress,
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

        return mapTaskRecord(row, input.participants);
      });
    },
    async updateTaskStatus(input) {
      const [row] = await db
        .update(tasks)
        .set({
          status: input.status,
          progress: input.progress,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(tasks.tenantId, input.tenantId),
            eq(tasks.projectId, input.projectId),
            eq(tasks.id, input.taskId),
            eq(tasks.status, input.expectedStatus),
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
      return mapTaskRecord(row, participantsByTask.get(input.taskId) ?? []);
    }
  };
}

function mapTaskRecord(
  row: typeof tasks.$inferSelect,
  participants: TaskParticipantRecord[]
): TaskRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    stageId: row.stageId,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    plannedStart: row.plannedStart,
    plannedFinish: row.plannedFinish,
    plannedWork: row.plannedWork,
    actualWork: row.actualWork,
    progress: row.progress,
    source: row.source as TaskSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    participants
  };
}
