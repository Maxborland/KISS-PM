import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import type {
  DependencyType,
  PlanningCommand,
  PlanAssignment,
  PlanAssignmentRole,
  PlanBaseline,
  PlanCalendar,
  PlanConstraint,
  PlanConstraintType,
  PlanDate,
  PlanResource,
  PlanSnapshot,
  PlanTask,
  ProjectSourceType,
  SchedulingMode,
  TaskType
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  calendarExceptions,
  planVersions,
  projectBaselineAssignments,
  projectBaselines,
  projectBaselineTasks,
  projectCalendars,
  projects,
  resourceCalendars,
  resourceReservations,
  planningScenarioRuns,
  taskAssignments,
  taskDependencies,
  taskStatuses,
  taskParticipants,
  tasks,
  tenantUsers
} from "./schema";

export type PlanningDependencyInput = {
  id: string;
  tenantId: string;
  projectId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: DependencyType;
  lagMinutes: number;
};

export type PlanningAssignmentInput = {
  id: string;
  tenantId: string;
  projectId: string;
  taskId: string;
  resourceId: string;
  role: PlanAssignmentRole;
  unitsPermille: number;
  workMinutes: number | null;
  calendarId: string | null;
};

export type PlanningRepository = {
  getPlanSnapshot(tenantId: string, projectId: string): Promise<PlanSnapshot | undefined>;
  ensurePlanVersion(tenantId: string, projectId: string): Promise<number>;
  incrementPlanVersion(tenantId: string, projectId: string): Promise<number>;
  createPlanningScenarioRun(input: PlanningScenarioRunInput): Promise<PlanningScenarioRunRecord>;
  findPlanningScenarioRun(
    tenantId: string,
    projectId: string,
    scenarioRunId: string
  ): Promise<PlanningScenarioRunRecord | undefined>;
  markPlanningScenarioRunApplied(input: {
    tenantId: string;
    projectId: string;
    scenarioRunId: string;
    appliedAt: Date;
  }): Promise<void>;
  applyPlanningCommand(input: {
    tenantId: string;
    projectId: string;
    actorUserId: string;
    command: PlanningCommand;
  }): Promise<void>;
  upsertTaskDependency(input: PlanningDependencyInput): Promise<void>;
  upsertTaskAssignment(input: PlanningAssignmentInput): Promise<void>;
};

export type PlanningScenarioRunInput = Omit<
  PlanningScenarioRunRecord,
  "createdAt" | "appliedAt"
> & {
  appliedAt?: Date | null;
  createdAt?: Date;
};

export type PlanningScenarioRunRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  planVersion: number;
  engineVersion: string;
  targetConflict: Record<string, unknown>;
  proposalPayload: Record<string, unknown>;
  proposalPayloadHash: string;
  actorUserId: string;
  expiresAt: Date;
  appliedAt: Date | null;
  createdAt: Date;
};

const defaultWorkingWeekdays = [1, 2, 3, 4, 5];
const defaultWorkingMinutesPerDay = 480;

type WbsTaskRow = Pick<typeof tasks.$inferSelect, "id" | "parentTaskId" | "wbsCode" | "createdAt">;

export function createPlanningRepository(db: KissPmDatabase): PlanningRepository {
  return {
    async getPlanSnapshot(tenantId, projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.tenantId, tenantId), eq(projects.id, projectId)))
        .limit(1);
      if (!project) return undefined;

      const [
        planVersion,
        taskRows,
        assignmentRows,
        dependencyRows,
        projectCalendarRows,
        resourceCalendarRows,
        exceptionRows,
        resourceRows,
        reservationRows,
        baselineRows,
        baselineTaskRows
      ] = await Promise.all([
        this.ensurePlanVersion(tenantId, projectId),
        db
          .select()
          .from(tasks)
          .where(and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
          .orderBy(asc(tasks.createdAt), asc(tasks.id)),
        db
          .select()
          .from(taskAssignments)
          .where(and(eq(taskAssignments.tenantId, tenantId), eq(taskAssignments.projectId, projectId)))
          .orderBy(asc(taskAssignments.id)),
        db
          .select()
          .from(taskDependencies)
          .where(and(eq(taskDependencies.tenantId, tenantId), eq(taskDependencies.projectId, projectId)))
          .orderBy(asc(taskDependencies.id)),
        db
          .select()
          .from(projectCalendars)
          .where(and(eq(projectCalendars.tenantId, tenantId), eq(projectCalendars.projectId, projectId)))
          .orderBy(asc(projectCalendars.id)),
        db
          .select()
          .from(resourceCalendars)
          .where(eq(resourceCalendars.tenantId, tenantId))
          .orderBy(asc(resourceCalendars.id)),
        db
          .select()
          .from(calendarExceptions)
          .where(and(eq(calendarExceptions.tenantId, tenantId), eq(calendarExceptions.projectId, projectId)))
          .orderBy(asc(calendarExceptions.date), asc(calendarExceptions.id)),
        db
          .select()
          .from(tenantUsers)
          .where(and(eq(tenantUsers.tenantId, tenantId), ne(tenantUsers.status, "inactive")))
          .orderBy(asc(tenantUsers.name), asc(tenantUsers.id)),
        db
          .select()
          .from(resourceReservations)
          .where(and(eq(resourceReservations.tenantId, tenantId), eq(resourceReservations.projectId, projectId)))
          .orderBy(asc(resourceReservations.start), asc(resourceReservations.id)),
        db
          .select()
          .from(projectBaselines)
          .where(and(eq(projectBaselines.tenantId, tenantId), eq(projectBaselines.projectId, projectId)))
          .orderBy(asc(projectBaselines.capturedAt), asc(projectBaselines.id)),
        db
          .select()
          .from(projectBaselineTasks)
          .where(and(eq(projectBaselineTasks.tenantId, tenantId), eq(projectBaselineTasks.projectId, projectId)))
      ]);

      const orderedTaskRows = [...taskRows].sort(compareTaskRowsByWbs);
      const activeTaskIds = new Set(orderedTaskRows.map((task) => task.id));
      const participantRows = activeTaskIds.size === 0
        ? []
        : await db
            .select()
            .from(taskParticipants)
            .where(
              and(
                eq(taskParticipants.tenantId, tenantId),
                inArray(taskParticipants.taskId, [...activeTaskIds])
              )
            );
      const activeResourceIds = new Set(resourceRows.map((resource) => resource.id));
      const calendars = mapCalendars(projectCalendarRows, resourceCalendarRows, project.id);
      const projectCalendarId = selectProjectCalendarId(project, projectCalendarRows);

      return {
        tenantId,
        projectId,
        planVersion,
        project: {
          id: project.id,
          sourceType: project.sourceType as ProjectSourceType,
          sourceOpportunityId: project.sourceOpportunityId,
          plannedStart: toPlanDate(project.plannedStart),
          plannedFinish: toPlanDate(project.plannedFinish),
          deadline: project.deadline ? toPlanDate(project.deadline) : null,
          calendarId: projectCalendarId
        },
        tasks: orderedTaskRows.map((task) => mapPlanTask(task, projectCalendarId)),
        assignments: mapAssignments(
          orderedTaskRows.map((task) => task.id),
          activeResourceIds,
          participantRows,
          assignmentRows
        ),
        dependencies: dependencyRows
          .filter(
            (dependency) =>
              activeTaskIds.has(dependency.predecessorTaskId) &&
              activeTaskIds.has(dependency.successorTaskId)
          )
          .map((dependency) => ({
            id: dependency.id,
            predecessorTaskId: dependency.predecessorTaskId,
            successorTaskId: dependency.successorTaskId,
            type: dependency.type as DependencyType,
            lagMinutes: dependency.lagMinutes
          })),
        baselines: mapBaselines(baselineRows, baselineTaskRows),
        calendars,
        calendarExceptions: exceptionRows.map((exception) => ({
          id: exception.id,
          calendarId: exception.calendarId,
          resourceId: exception.resourceId,
          date: exception.date,
          workingMinutes: exception.workingMinutes,
          reason: exception.reason
        })),
        resources: resourceRows.map<PlanResource>((resource) => ({
          id: resource.id,
          userId: resource.id,
          positionId: resource.positionId,
          teamId: null,
          name: resource.name,
          calendarId: resourceCalendarRows.find((calendar) => calendar.resourceId === resource.id)?.id ?? null
        })),
        reservations: reservationRows.map((reservation) => ({
          id: reservation.id,
          resourceId: reservation.resourceId,
          projectId: reservation.projectId,
          start: reservation.start,
          finish: reservation.finish,
          workMinutes: reservation.workMinutes,
          reason: reservation.reason
        })),
        constraints: orderedTaskRows.flatMap((task) => {
          const constraint = mapConstraint(task);
          return constraint ? [constraint] : [];
        }),
        capturedAt: new Date().toISOString()
      };
    },

    async ensurePlanVersion(tenantId, projectId) {
      const now = new Date();
      await db
        .insert(planVersions)
        .values({
          tenantId,
          projectId,
          version: 1,
          updatedAt: now
        })
        .onConflictDoNothing();

      const [row] = await db
        .select()
        .from(planVersions)
        .where(and(eq(planVersions.tenantId, tenantId), eq(planVersions.projectId, projectId)))
        .limit(1);
      return row?.version ?? 1;
    },

    async incrementPlanVersion(tenantId, projectId) {
      const currentVersion = await this.ensurePlanVersion(tenantId, projectId);
      const nextVersion = currentVersion + 1;
      await db
        .update(planVersions)
        .set({ version: nextVersion, updatedAt: new Date() })
        .where(and(eq(planVersions.tenantId, tenantId), eq(planVersions.projectId, projectId)));
      return nextVersion;
    },

    async createPlanningScenarioRun(input) {
      const [row] = await db
        .insert(planningScenarioRuns)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          projectId: input.projectId,
          planVersion: input.planVersion,
          engineVersion: input.engineVersion,
          targetConflict: input.targetConflict,
          proposalPayload: input.proposalPayload,
          proposalPayloadHash: input.proposalPayloadHash,
          actorUserId: input.actorUserId,
          expiresAt: input.expiresAt,
          appliedAt: input.appliedAt ?? null,
          createdAt: input.createdAt ?? new Date()
        })
        .onConflictDoUpdate({
          target: [
            planningScenarioRuns.tenantId,
            planningScenarioRuns.projectId,
            planningScenarioRuns.id
          ],
          set: {
            planVersion: input.planVersion,
            engineVersion: input.engineVersion,
            targetConflict: input.targetConflict,
            proposalPayload: input.proposalPayload,
            proposalPayloadHash: input.proposalPayloadHash,
            actorUserId: input.actorUserId,
            expiresAt: input.expiresAt,
            appliedAt: input.appliedAt ?? null
          }
        })
        .returning();
      if (!row) throw new Error("Planning scenario insert returned no row");
      return mapPlanningScenarioRun(row);
    },

    async findPlanningScenarioRun(tenantId, projectId, scenarioRunId) {
      const [row] = await db
        .select()
        .from(planningScenarioRuns)
        .where(
          and(
            eq(planningScenarioRuns.tenantId, tenantId),
            eq(planningScenarioRuns.projectId, projectId),
            eq(planningScenarioRuns.id, scenarioRunId)
          )
        )
        .limit(1);
      return row ? mapPlanningScenarioRun(row) : undefined;
    },

    async markPlanningScenarioRunApplied(input) {
      await db
        .update(planningScenarioRuns)
        .set({ appliedAt: input.appliedAt })
        .where(
          and(
            eq(planningScenarioRuns.tenantId, input.tenantId),
            eq(planningScenarioRuns.projectId, input.projectId),
            eq(planningScenarioRuns.id, input.scenarioRunId)
          )
        );
    },

    async applyPlanningCommand(input) {
      switch (input.command.type) {
        case "task.create": {
          const payload = input.command.payload;
          const [project] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, input.projectId)))
            .limit(1);
          if (!project) throw new Error("project_not_found");
          const [status] = await db
            .select()
            .from(taskStatuses)
            .where(
              and(
                eq(taskStatuses.tenantId, input.tenantId),
                eq(taskStatuses.id, payload.statusId)
              )
            )
            .limit(1);
          const ownerUserId =
            payload.assignments.find((assignment) => assignment.role === "executor")
              ?.resourceId ?? input.actorUserId;
          const plannedStart = payload.plannedStart ?? toPlanDate(project.plannedStart);
          const plannedFinish = payload.plannedFinish ?? plannedStart;
          const now = new Date();
          await db.insert(tasks).values({
            id: payload.id,
            tenantId: input.tenantId,
            projectId: input.projectId,
            stageId: null,
            title: payload.title,
            description: null,
            status: status?.category ?? "new",
            statusId: payload.statusId,
            priority: "normal",
            requesterUserId: input.actorUserId,
            ownerUserId,
            plannedStart: fromPlanDate(plannedStart),
            plannedFinish: fromPlanDate(plannedFinish),
            durationWorkingDays: Math.max(
              1,
              Math.ceil((payload.durationMinutes ?? payload.workMinutes) / 480)
            ),
            plannedWork: Math.ceil(payload.workMinutes / 60),
            actualWork: 0,
            progress: 0,
            requiresAcceptance: false,
            source: "manual",
            parentTaskId: payload.parentTaskId ?? null,
            wbsCode: await nextWbsCode(input.tenantId, input.projectId, payload.parentTaskId ?? null),
            schedulingMode: "auto",
            taskType: "fixed_units",
            effortDriven: false,
            durationMinutes: payload.durationMinutes ?? null,
            workMinutes: payload.workMinutes,
            plannedStartMinute: 0,
            plannedFinishMinute: 0,
            constraintType: null,
            constraintDate: null,
            createdAt: now,
            updatedAt: now
          });
          await db.insert(taskParticipants).values(
            normalizeParticipantRows({
            tenantId: input.tenantId,
              taskId: payload.id,
              actorUserId: input.actorUserId,
              assignments: payload.assignments
            })
          );
          if (payload.assignments.length > 0) {
            await db.insert(taskAssignments).values(
              payload.assignments.map((assignment, index) => ({
                id: assignment.id ?? `${payload.id}-assignment-${index + 1}`,
                tenantId: input.tenantId,
                projectId: input.projectId,
                taskId: payload.id,
                resourceId: assignment.resourceId,
                role: assignment.role,
                unitsPermille: assignment.unitsPermille,
                workMinutes: assignment.workMinutes ?? null,
                calendarId: null
              }))
            );
          }
          return;
        }
        case "task.update_identity":
          await db
            .update(tasks)
            .set({ title: input.command.payload.title, updatedAt: new Date() })
            .where(
              and(
                eq(tasks.tenantId, input.tenantId),
                eq(tasks.projectId, input.projectId),
                eq(tasks.id, input.command.payload.taskId)
              )
            );
          return;
        case "task.update_schedule":
          {
            const [task] = await db
              .select()
              .from(tasks)
              .where(
                and(
                  eq(tasks.tenantId, input.tenantId),
                  eq(tasks.projectId, input.projectId),
                  eq(tasks.id, input.command.payload.taskId)
                )
              )
              .limit(1);
            if (!task) return;
            const plannedStart = input.command.payload.plannedStart
              ? fromPlanDate(input.command.payload.plannedStart)
              : task.plannedStart;
            const plannedFinish = input.command.payload.plannedFinish
              ? fromPlanDate(input.command.payload.plannedFinish)
              : task.plannedFinish;
            await db
              .update(tasks)
              .set({
                plannedStart,
                plannedFinish,
                updatedAt: new Date()
              })
              .where(
                and(
                  eq(tasks.tenantId, input.tenantId),
                  eq(tasks.projectId, input.projectId),
                  eq(tasks.id, input.command.payload.taskId)
                )
              );
          }
          return;
        case "task.update_work_model":
          await db
            .update(tasks)
            .set({
              taskType: input.command.payload.taskType,
              effortDriven: input.command.payload.effortDriven,
              durationMinutes: input.command.payload.durationMinutes,
              workMinutes: input.command.payload.workMinutes,
              durationWorkingDays: Math.max(
                1,
                Math.ceil((input.command.payload.durationMinutes ?? input.command.payload.workMinutes) / 480)
              ),
              plannedWork: Math.max(0, Math.ceil(input.command.payload.workMinutes / 60)),
              updatedAt: new Date()
            })
            .where(
              and(
                eq(tasks.tenantId, input.tenantId),
                eq(tasks.projectId, input.projectId),
                eq(tasks.id, input.command.payload.taskId)
              )
            );
          return;
        case "task.update_status": {
          const [status] = await db
            .select()
            .from(taskStatuses)
            .where(
              and(
                eq(taskStatuses.tenantId, input.tenantId),
                eq(taskStatuses.id, input.command.payload.statusId)
              )
            )
            .limit(1);
          await db
            .update(tasks)
            .set({
              statusId: input.command.payload.statusId,
              status: status?.category ?? "new",
              progress: deriveProgressExpression(status?.category),
              updatedAt: new Date()
            })
            .where(
              and(
                eq(tasks.tenantId, input.tenantId),
                eq(tasks.projectId, input.projectId),
                eq(tasks.id, input.command.payload.taskId)
              )
            );
          return;
        }
        case "task.move_wbs":
          await moveTaskWbs({
            tenantId: input.tenantId,
            projectId: input.projectId,
            taskId: input.command.payload.taskId,
            parentTaskId: input.command.payload.parentTaskId,
            sortOrder: input.command.payload.sortOrder
          });
          return;
        case "task.delete_or_archive":
          if (input.command.payload.mode === "delete") {
            await db
              .delete(tasks)
              .where(
                and(
                  eq(tasks.tenantId, input.tenantId),
                  eq(tasks.projectId, input.projectId),
                  eq(tasks.id, input.command.payload.taskId)
                )
              );
            return;
          }
          await db
            .update(tasks)
            .set({ archivedAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(tasks.tenantId, input.tenantId),
                eq(tasks.projectId, input.projectId),
                eq(tasks.id, input.command.payload.taskId)
              )
            );
          return;
        case "dependency.upsert":
          {
            const [existing] = await db
              .select({
                predecessorTaskId: taskDependencies.predecessorTaskId,
                successorTaskId: taskDependencies.successorTaskId
              })
              .from(taskDependencies)
              .where(
                and(
                  eq(taskDependencies.tenantId, input.tenantId),
                  eq(taskDependencies.projectId, input.projectId),
                  eq(taskDependencies.id, input.command.payload.id)
                )
              )
              .limit(1);
            await this.upsertTaskDependency({
              id: input.command.payload.id,
              tenantId: input.tenantId,
              projectId: input.projectId,
              predecessorTaskId: input.command.payload.predecessorTaskId,
              successorTaskId: input.command.payload.successorTaskId,
              type: input.command.payload.dependencyType,
              lagMinutes: input.command.payload.lagMinutes
            });
            await touchTasksUpdatedAt({
              tenantId: input.tenantId,
              projectId: input.projectId,
              taskIds: [
                existing?.predecessorTaskId,
                existing?.successorTaskId,
                input.command.payload.predecessorTaskId,
                input.command.payload.successorTaskId
              ]
            });
          }
          return;
        case "dependency.delete":
          {
            const [existing] = await db
              .select({
                predecessorTaskId: taskDependencies.predecessorTaskId,
                successorTaskId: taskDependencies.successorTaskId
              })
              .from(taskDependencies)
              .where(
                and(
                  eq(taskDependencies.tenantId, input.tenantId),
                  eq(taskDependencies.projectId, input.projectId),
                  eq(taskDependencies.id, input.command.payload.dependencyId)
                )
              )
              .limit(1);
            await db
              .delete(taskDependencies)
              .where(
                and(
                  eq(taskDependencies.tenantId, input.tenantId),
                  eq(taskDependencies.projectId, input.projectId),
                  eq(taskDependencies.id, input.command.payload.dependencyId)
                )
              );
            await touchTasksUpdatedAt({
              tenantId: input.tenantId,
              projectId: input.projectId,
              taskIds: [existing?.predecessorTaskId, existing?.successorTaskId]
            });
          }
          return;
        case "assignment.upsert":
          {
            const [existing] = await db
              .select()
              .from(taskAssignments)
              .where(
                and(
                  eq(taskAssignments.tenantId, input.tenantId),
                  eq(taskAssignments.projectId, input.projectId),
                  eq(taskAssignments.id, input.command.payload.id)
                )
              )
              .limit(1);
            if (
              existing &&
              (existing.taskId !== input.command.payload.taskId ||
                existing.resourceId !== input.command.payload.resourceId ||
                existing.role !== input.command.payload.role)
            ) {
              await deleteParticipantIfNoSiblingAssignment({
                tenantId: input.tenantId,
                projectId: input.projectId,
                assignmentId: existing.id,
                taskId: existing.taskId,
                resourceId: existing.resourceId,
                role: existing.role
              });
            }
            await this.upsertTaskAssignment({
              ...input.command.payload,
              tenantId: input.tenantId,
              projectId: input.projectId,
              calendarId: null
            });
            await db
              .insert(taskParticipants)
              .values({
                tenantId: input.tenantId,
                taskId: input.command.payload.taskId,
                userId: input.command.payload.resourceId,
                role: input.command.payload.role
              })
              .onConflictDoNothing();
            await touchTasksUpdatedAt({
              tenantId: input.tenantId,
              projectId: input.projectId,
              taskIds: [existing?.taskId, input.command.payload.taskId]
            });
          }
          return;
        case "assignment.delete":
          {
            const [existing] = await db
              .select()
              .from(taskAssignments)
              .where(
                and(
                  eq(taskAssignments.tenantId, input.tenantId),
                  eq(taskAssignments.projectId, input.projectId),
                  eq(taskAssignments.id, input.command.payload.assignmentId)
                )
              )
              .limit(1);
            if (existing) {
              await deleteParticipantIfNoSiblingAssignment({
                tenantId: input.tenantId,
                projectId: input.projectId,
                assignmentId: existing.id,
                taskId: existing.taskId,
                resourceId: existing.resourceId,
                role: existing.role
              });
            }
            await db
              .delete(taskAssignments)
              .where(
                and(
                  eq(taskAssignments.tenantId, input.tenantId),
                  eq(taskAssignments.projectId, input.projectId),
                  eq(taskAssignments.id, input.command.payload.assignmentId)
                )
              );
            await touchTasksUpdatedAt({
              tenantId: input.tenantId,
              projectId: input.projectId,
              taskIds: [existing?.taskId]
            });
          }
          return;
        case "baseline.capture":
          await captureBaseline(input.tenantId, input.projectId, input.command.payload.baselineId, input.command.payload.label);
          return;
        case "calendar.exception.upsert":
          await db
            .insert(calendarExceptions)
            .values({
              ...input.command.payload,
              tenantId: input.tenantId,
              projectId: input.projectId,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .onConflictDoUpdate({
              target: [calendarExceptions.tenantId, calendarExceptions.projectId, calendarExceptions.id],
              set: {
                calendarId: input.command.payload.calendarId,
                resourceId: input.command.payload.resourceId,
                date: input.command.payload.date,
                workingMinutes: input.command.payload.workingMinutes,
                reason: input.command.payload.reason,
                updatedAt: new Date()
              }
            });
          return;
        case "constraint.update":
          await db
            .update(tasks)
            .set({
              constraintType: input.command.payload.type,
              constraintDate: input.command.payload.date ? fromPlanDate(input.command.payload.date) : null,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(tasks.tenantId, input.tenantId),
                eq(tasks.projectId, input.projectId),
                eq(tasks.id, input.command.payload.taskId)
              )
            );
          return;
        case "resource.reserve":
          await db
            .insert(resourceReservations)
            .values({
              ...input.command.payload,
              tenantId: input.tenantId,
              projectId: input.projectId
            })
            .onConflictDoUpdate({
              target: [resourceReservations.tenantId, resourceReservations.projectId, resourceReservations.id],
              set: {
                resourceId: input.command.payload.resourceId,
                start: input.command.payload.start,
                finish: input.command.payload.finish,
                workMinutes: input.command.payload.workMinutes,
                reason: input.command.payload.reason
              }
            });
          return;
        case "risk.accept_overload":
          return;
        case "project.deadline.move":
          await db
            .update(projects)
            .set({ deadline: fromPlanDate(input.command.payload.deadline) })
            .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, input.projectId)));
          return;
      }
    },

    async upsertTaskDependency(input) {
      await db
        .insert(taskDependencies)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          projectId: input.projectId,
          predecessorTaskId: input.predecessorTaskId,
          successorTaskId: input.successorTaskId,
          type: input.type,
          lagMinutes: input.lagMinutes
        })
        .onConflictDoUpdate({
          target: [taskDependencies.tenantId, taskDependencies.projectId, taskDependencies.id],
          set: {
            predecessorTaskId: input.predecessorTaskId,
            successorTaskId: input.successorTaskId,
            type: input.type,
            lagMinutes: input.lagMinutes
          }
        });
    },

    async upsertTaskAssignment(input) {
      await db
        .insert(taskAssignments)
        .values(input)
        .onConflictDoUpdate({
          target: [taskAssignments.tenantId, taskAssignments.projectId, taskAssignments.id],
          set: {
            taskId: input.taskId,
            resourceId: input.resourceId,
            role: input.role,
            unitsPermille: input.unitsPermille,
            workMinutes: input.workMinutes,
            calendarId: input.calendarId
          }
        });
    }
  };

  async function nextWbsCode(
    tenantId: string,
    projectId: string,
    parentTaskId: string | null
  ): Promise<string> {
    const rows = await db
      .select({
        id: tasks.id,
        parentTaskId: tasks.parentTaskId,
        wbsCode: tasks.wbsCode,
        createdAt: tasks.createdAt
      })
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)));

    rows.sort(compareTaskRowsByWbs);
    if (parentTaskId !== null) {
      const parent = rows.find((task) => task.id === parentTaskId);
      if (!parent) throw new Error("parent_task_not_found");
      const maxChildCode = rows.reduce((max, task) => {
        if (task.parentTaskId !== parentTaskId) return max;
        const childCode = parseWbsPart(task.wbsCode.split(".").at(-1) ?? "");
        return childCode === null ? max : Math.max(max, childCode);
      }, 0);
      return `${parent.wbsCode}.${maxChildCode + 1}`;
    }

    const maxNumericWbsCode = rows.reduce((max, task) => {
      if (task.parentTaskId !== null) return max;
      const numericCode = parseWbsPart(task.wbsCode);
      return numericCode === null ? max : Math.max(max, numericCode);
    }, 0);
    return String(maxNumericWbsCode + 1);
  }

  async function deleteParticipantIfNoSiblingAssignment(input: {
    tenantId: string;
    projectId: string;
    assignmentId: string;
    taskId: string;
    resourceId: string;
    role: string;
  }): Promise<void> {
    const [sibling] = await db
      .select({ id: taskAssignments.id })
      .from(taskAssignments)
      .where(
        and(
          eq(taskAssignments.tenantId, input.tenantId),
          eq(taskAssignments.projectId, input.projectId),
          eq(taskAssignments.taskId, input.taskId),
          eq(taskAssignments.resourceId, input.resourceId),
          eq(taskAssignments.role, input.role),
          ne(taskAssignments.id, input.assignmentId)
        )
      )
      .limit(1);
    if (sibling) return;

    await db
      .delete(taskParticipants)
      .where(
        and(
          eq(taskParticipants.tenantId, input.tenantId),
          eq(taskParticipants.taskId, input.taskId),
          eq(taskParticipants.userId, input.resourceId),
          eq(taskParticipants.role, input.role)
        )
      );
  }

  async function touchTasksUpdatedAt(input: {
    tenantId: string;
    projectId: string;
    taskIds: Array<string | null | undefined>;
  }): Promise<void> {
    const taskIds = [...new Set(input.taskIds.filter((taskId): taskId is string => Boolean(taskId)))];
    if (taskIds.length === 0) return;

    const now = new Date();
    await db
      .update(tasks)
      .set({ updatedAt: now })
      .where(
        and(
          eq(tasks.tenantId, input.tenantId),
          eq(tasks.projectId, input.projectId),
          inArray(tasks.id, taskIds)
        )
      );
  }

  async function moveTaskWbs(input: {
    tenantId: string;
    projectId: string;
    taskId: string;
    parentTaskId: string | null;
    sortOrder: number;
  }): Promise<void> {
    const rows = await db
      .select({
        id: tasks.id,
        parentTaskId: tasks.parentTaskId,
        wbsCode: tasks.wbsCode,
        createdAt: tasks.createdAt
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, input.tenantId),
          eq(tasks.projectId, input.projectId),
          isNull(tasks.archivedAt)
        )
      )
      .orderBy(asc(tasks.createdAt), asc(tasks.id));
    rows.sort(compareTaskRowsByWbs);
    const moved = rows.find((task) => task.id === input.taskId);
    if (!moved) return;
    if (input.parentTaskId !== null && !rows.some((task) => task.id === input.parentTaskId)) {
      throw new Error("parent_task_not_found");
    }

    const retargeted = rows.map((task) =>
      task.id === input.taskId ? { ...task, parentTaskId: input.parentTaskId } : task
    );
    const siblingIds = retargeted
      .filter((task) => task.parentTaskId === input.parentTaskId && task.id !== input.taskId)
      .map((task) => task.id);
    const index = Math.max(0, Math.min(input.sortOrder, siblingIds.length));
    const targetSiblingIds = [...siblingIds.slice(0, index), moved.id, ...siblingIds.slice(index)];
    const siblingOrderOverrides = new Map<string, number>();
    targetSiblingIds.forEach((id, siblingIndex) => siblingOrderOverrides.set(id, siblingIndex));
    const nextRows = reindexTaskRowsByWbs(retargeted, siblingOrderOverrides);
    const now = new Date();

    await Promise.all(
      nextRows.map((task) =>
        db
          .update(tasks)
          .set({
            parentTaskId: task.parentTaskId,
            wbsCode: task.wbsCode,
            updatedAt: now
          })
          .where(
            and(
              eq(tasks.tenantId, input.tenantId),
              eq(tasks.projectId, input.projectId),
              eq(tasks.id, task.id)
            )
          )
      )
    );
  }

  async function captureBaseline(
    tenantId: string,
    projectId: string,
    baselineId: string,
    label: string
  ): Promise<void> {
    const now = new Date();
    const taskRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)));
    const assignmentRows = await db
      .select()
      .from(taskAssignments)
      .where(and(eq(taskAssignments.tenantId, tenantId), eq(taskAssignments.projectId, projectId)));
    const activeTaskIds = new Set(taskRows.map((task) => task.id));
    const activeAssignmentRows = assignmentRows.filter((assignment) => activeTaskIds.has(assignment.taskId));
    await db
      .insert(projectBaselines)
      .values({ id: baselineId, tenantId, projectId, label, capturedAt: now })
      .onConflictDoUpdate({
        target: [projectBaselines.tenantId, projectBaselines.projectId, projectBaselines.id],
        set: { label, capturedAt: now }
      });
    await db
      .delete(projectBaselineTasks)
      .where(
        and(
          eq(projectBaselineTasks.tenantId, tenantId),
          eq(projectBaselineTasks.projectId, projectId),
          eq(projectBaselineTasks.baselineId, baselineId)
        )
      );
    await db
      .delete(projectBaselineAssignments)
      .where(
        and(
          eq(projectBaselineAssignments.tenantId, tenantId),
          eq(projectBaselineAssignments.projectId, projectId),
          eq(projectBaselineAssignments.baselineId, baselineId)
        )
      );
    if (taskRows.length > 0) {
      await db.insert(projectBaselineTasks).values(
        taskRows.map((task) => ({
          tenantId,
          projectId,
          baselineId,
          taskId: task.id,
          plannedStart: toPlanDate(task.plannedStart),
          plannedFinish: toPlanDate(task.plannedFinish),
          workMinutes: task.workMinutes ?? task.plannedWork * 60
        }))
      );
    }
    if (activeAssignmentRows.length > 0) {
      await db.insert(projectBaselineAssignments).values(
        activeAssignmentRows.map((assignment) => ({
          tenantId,
          projectId,
          baselineId,
          assignmentId: assignment.id,
          taskId: assignment.taskId,
          resourceId: assignment.resourceId,
          workMinutes: assignment.workMinutes
        }))
      );
    }
  }
}

function mapPlanTask(
  task: typeof tasks.$inferSelect,
  projectCalendarId: string
): PlanTask {
  const constraint = mapConstraint(task);
  return {
    id: task.id,
    parentTaskId: task.parentTaskId,
    wbsCode: task.wbsCode,
    title: task.title,
    statusId: task.statusId,
    schedulingMode: task.schedulingMode as SchedulingMode,
    taskType: task.taskType as TaskType,
    effortDriven: task.effortDriven,
    plannedStart: toPlanDate(task.plannedStart),
    plannedFinish: toPlanDate(task.plannedFinish),
    plannedStartInstant: {
      date: toPlanDate(task.plannedStart),
      minuteOfDay: task.plannedStartMinute
    },
    plannedFinishInstant: {
      date: toPlanDate(task.plannedFinish),
      minuteOfDay: task.plannedFinishMinute
    },
    durationMinutes: task.durationMinutes ?? Math.max(1, task.durationWorkingDays) * 480,
    workMinutes: task.workMinutes ?? Math.max(0, task.plannedWork) * 60,
    percentComplete: task.progress,
    calendarId: projectCalendarId,
    constraint
  };
}

function mapConstraint(task: typeof tasks.$inferSelect): PlanConstraint | null {
  if (!task.constraintType) return null;
  return {
    id: `constraint-${task.id}`,
    taskId: task.id,
    type: task.constraintType as PlanConstraintType,
    date: task.constraintDate ? toPlanDate(task.constraintDate) : null
  };
}

function reindexTaskRowsByWbs<T extends WbsTaskRow>(
  rows: T[],
  siblingOrderOverrides: Map<string, number> = new Map()
): T[] {
  const taskIds = new Set(rows.map((task) => task.id));
  const inputOrderById = new Map(rows.map((task, index) => [task.id, index]));
  const rowsByParentId = new Map<string | null, T[]>();

  for (const row of rows) {
    const parentId = row.parentTaskId !== null && taskIds.has(row.parentTaskId) ? row.parentTaskId : null;
    const normalizedRow = parentId === row.parentTaskId ? row : { ...row, parentTaskId: null };
    rowsByParentId.set(parentId, [...(rowsByParentId.get(parentId) ?? []), normalizedRow]);
  }

  const result: T[] = [];
  const emittedTaskIds = new Set<string>();

  const appendChildren = (parentId: string | null, prefix: string): void => {
    const siblings = [...(rowsByParentId.get(parentId) ?? [])].sort((left, right) => {
      const leftOverride = siblingOrderOverrides.get(left.id);
      const rightOverride = siblingOrderOverrides.get(right.id);
      if (leftOverride !== undefined || rightOverride !== undefined) {
        return (leftOverride ?? Number.MAX_SAFE_INTEGER) - (rightOverride ?? Number.MAX_SAFE_INTEGER);
      }
      return (
        compareTaskRowsByWbs(left, right) ||
        (inputOrderById.get(left.id) ?? 0) - (inputOrderById.get(right.id) ?? 0)
      );
    });

    siblings.forEach((task, index) => {
      if (emittedTaskIds.has(task.id)) return;
      const wbsCode = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      emittedTaskIds.add(task.id);
      result.push({ ...task, wbsCode });
      appendChildren(task.id, wbsCode);
    });
  };

  appendChildren(null, "");
  return result;
}

function compareTaskRowsByWbs(
  left: Pick<typeof tasks.$inferSelect, "wbsCode" | "createdAt" | "id">,
  right: Pick<typeof tasks.$inferSelect, "wbsCode" | "createdAt" | "id">
): number {
  return (
    compareWbsCodes(left.wbsCode, right.wbsCode) ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

function compareWbsCodes(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumber = parseWbsPart(leftPart);
    const rightNumber = parseWbsPart(rightPart);
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return leftPart.localeCompare(rightPart, undefined, { numeric: true });
  }

  return 0;
}

function parseWbsPart(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function mapAssignments(
  taskIds: string[],
  activeResourceIds: Set<string>,
  participantRows: Array<typeof taskParticipants.$inferSelect>,
  assignmentRows: Array<typeof taskAssignments.$inferSelect>
): PlanAssignment[] {
  const taskIdSet = new Set(taskIds);
  const activeAssignmentRows = assignmentRows.filter(
    (assignment) =>
      taskIdSet.has(assignment.taskId) &&
      activeResourceIds.has(assignment.resourceId)
  );
  const explicitAssignmentKeys = new Set(
    activeAssignmentRows.map((assignment) =>
      assignmentFallbackKey(assignment.taskId, assignment.resourceId, assignment.role)
    )
  );
  const explicitAssignments = activeAssignmentRows.map<PlanAssignment>((assignment) => ({
    id: assignment.id,
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    role: assignment.role as PlanAssignmentRole,
    unitsPermille: assignment.unitsPermille,
    workMinutes: assignment.workMinutes,
    calendarId: assignment.calendarId
  }));
  const fallbackAssignments = participantRows
    .filter(
      (participant) =>
        taskIdSet.has(participant.taskId) &&
        activeResourceIds.has(participant.userId) &&
        isPlanningParticipantRole(participant.role) &&
        !explicitAssignmentKeys.has(
          assignmentFallbackKey(participant.taskId, participant.userId, participant.role)
        )
    )
    .map<PlanAssignment>((participant) => ({
      id: `${participant.taskId}-${participant.userId}-${participant.role}`,
      taskId: participant.taskId,
      resourceId: participant.userId,
      role: participant.role as PlanAssignmentRole,
      unitsPermille: 1000,
      workMinutes: null,
      calendarId: null
    }));

  return [...explicitAssignments, ...fallbackAssignments].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function assignmentFallbackKey(taskId: string, resourceId: string, role: string): string {
  return `${taskId}\u0000${resourceId}\u0000${role}`;
}

function mapCalendars(
  projectCalendarRows: Array<typeof projectCalendars.$inferSelect>,
  resourceCalendarRows: Array<typeof resourceCalendars.$inferSelect>,
  projectId: string
): PlanCalendar[] {
  const projectPlanCalendars = projectCalendarRows.length > 0
    ? projectCalendarRows.map<PlanCalendar>((calendar) => ({
        id: calendar.id,
        workingWeekdays: calendar.workingWeekdays,
        workingMinutesPerDay: calendar.workingMinutesPerDay
      }))
    : [
        {
          id: defaultProjectCalendarId(projectId),
          workingWeekdays: defaultWorkingWeekdays,
          workingMinutesPerDay: defaultWorkingMinutesPerDay
        }
      ];

  const calendars = [
    ...projectPlanCalendars,
    ...resourceCalendarRows.map<PlanCalendar>((calendar) => ({
      id: calendar.id,
      workingWeekdays: calendar.workingWeekdays,
      workingMinutesPerDay: calendar.workingMinutesPerDay
    }))
  ];

  return calendars;
}

function selectProjectCalendarId(
  project: typeof projects.$inferSelect,
  projectCalendarRows: Array<typeof projectCalendars.$inferSelect>
): string {
  return project.calendarId ?? projectCalendarRows[0]?.id ?? defaultProjectCalendarId(project.id);
}

function mapBaselines(
  baselineRows: Array<typeof projectBaselines.$inferSelect>,
  baselineTaskRows: Array<typeof projectBaselineTasks.$inferSelect>
): PlanBaseline[] {
  return baselineRows.map((baseline) => ({
    id: baseline.id,
    capturedAt: baseline.capturedAt.toISOString(),
    tasks: baselineTaskRows
      .filter((task) => task.baselineId === baseline.id)
      .map((task) => ({
        taskId: task.taskId,
        plannedStart: task.plannedStart,
        plannedFinish: task.plannedFinish,
        workMinutes: task.workMinutes
      }))
  }));
}

function isPlanningParticipantRole(role: string): role is PlanAssignmentRole {
  return role !== "requester";
}

function deriveProgressExpression(statusCategory: string | undefined) {
  if (statusCategory === "done") return 100;
  if (statusCategory === "new") return 0;
  if (statusCategory === "in_progress") return sql`greatest(${tasks.progress}, 10)`;
  if (statusCategory === "review") return sql`greatest(${tasks.progress}, 80)`;
  return sql`${tasks.progress}`;
}

function defaultProjectCalendarId(projectId: string): string {
  return `${projectId}-default-calendar`;
}

function toPlanDate(date: Date): PlanDate {
  return date.toISOString().slice(0, 10);
}

function fromPlanDate(date: PlanDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function normalizeParticipantRows(input: {
  tenantId: string;
  taskId: string;
  actorUserId: string;
  assignments: Array<{ resourceId: string; role: PlanAssignmentRole }>;
}) {
  const participantRows = new Map<string, { tenantId: string; taskId: string; userId: string; role: string }>();
  participantRows.set(`${input.actorUserId}:requester`, {
    tenantId: input.tenantId,
    taskId: input.taskId,
    userId: input.actorUserId,
    role: "requester"
  });
  for (const assignment of input.assignments) {
    participantRows.set(`${assignment.resourceId}:${assignment.role}`, {
      tenantId: input.tenantId,
      taskId: input.taskId,
      userId: assignment.resourceId,
      role: assignment.role
    });
  }
  return [...participantRows.values()];
}

function mapPlanningScenarioRun(
  row: typeof planningScenarioRuns.$inferSelect
): PlanningScenarioRunRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    planVersion: row.planVersion,
    engineVersion: row.engineVersion,
    targetConflict: row.targetConflict,
    proposalPayload: row.proposalPayload,
    proposalPayloadHash: row.proposalPayloadHash,
    actorUserId: row.actorUserId,
    expiresAt: row.expiresAt,
    appliedAt: row.appliedAt,
    createdAt: row.createdAt
  };
}
