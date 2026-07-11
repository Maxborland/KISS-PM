import { allocatePlanningAssignmentId, planningAssignmentId } from "@kiss-pm/domain";
import type {
  PlanAssignment,
  PlanAssignmentRole,
  PlanningCommand,
  PlanSnapshot
} from "@kiss-pm/domain";
import type { TaskParticipantRecord, TaskRecord } from "@kiss-pm/persistence";

import type { CreateTaskBody, UpdateTaskBody } from "./projectWorkParsers";

const planningParticipantRoles = new Set<PlanAssignmentRole>([
  "executor",
  "co_executor",
  "controller",
  "approver",
  "observer"
]);

type TaskPlanningAssignment = {
  id: string;
  resourceId: string;
  role: PlanAssignmentRole;
  unitsPermille: number;
  workMinutes: number | null;
};

type PlanningParticipantRecord = TaskParticipantRecord & { role: PlanAssignmentRole };

export function buildCreateTaskPlanningCommand(input: {
  taskId: string;
  projectId: string;
  statusId: string;
  body: CreateTaskBody;
  participants: TaskParticipantRecord[];
  projectAssignments: readonly PlanAssignment[];
}): PlanningCommand {
  return {
    type: "task.create",
    payload: {
      id: input.taskId,
      projectId: input.projectId,
      title: input.body.title,
      statusId: input.statusId,
      plannedStart: dateToPlanDate(input.body.plannedStart),
      plannedFinish: dateToPlanDate(input.body.plannedFinish),
      durationMinutes: input.body.durationWorkingDays * 480,
      workMinutes: input.body.plannedWork * 60,
      assignments: preserveExistingAssignmentIds(
        [],
        taskParticipantsToAssignments(input.taskId, input.participants, {
          durationMinutes: input.body.durationWorkingDays * 480,
          workMinutes: input.body.plannedWork * 60
        }),
        new Set(input.projectAssignments.map((assignment) => assignment.id))
      )
    }
  };
}

export function buildUpdateTaskPlanningCommands(input: {
  task: TaskRecord;
  body: UpdateTaskBody;
  participants: TaskParticipantRecord[];
  snapshot: PlanSnapshot;
  projectAssignments: readonly PlanAssignment[];
}): PlanningCommand[] {
  const commands: PlanningCommand[] = [];
  const snapshotTask = input.snapshot.tasks.find((task) => task.id === input.task.id);
  const desiredStart = dateToPlanDate(input.body.plannedStart);
  const desiredFinish = dateToPlanDate(input.body.plannedFinish);
  const desiredWorkMinutes = input.body.plannedWork * 60;
  const desiredDurationMinutes = input.body.durationWorkingDays * 480;

  if (input.body.title !== input.task.title) {
    commands.push({
      type: "task.update_identity",
      payload: { taskId: input.task.id, title: input.body.title }
    });
  }

  if (
    desiredStart !== dateToPlanDate(input.task.plannedStart) ||
    desiredFinish !== dateToPlanDate(input.task.plannedFinish)
  ) {
    commands.push({
      type: "task.update_schedule",
      payload: {
        taskId: input.task.id,
        plannedStart: desiredStart,
        plannedFinish: desiredFinish
      }
    });
  }

  const workModelChanged =
    input.body.plannedWork !== input.task.plannedWork ||
    input.body.durationWorkingDays !== input.task.durationWorkingDays;

  if (workModelChanged) {
    commands.push({
      type: "task.update_work_model",
      payload: {
        taskId: input.task.id,
        taskType: snapshotTask?.taskType ?? "fixed_units",
        effortDriven: snapshotTask?.effortDriven ?? false,
        durationMinutes: desiredDurationMinutes,
        workMinutes: desiredWorkMinutes
      }
    });
  }

  if (input.body.statusId !== input.task.statusId) {
    commands.push({
      type: "task.update_status",
      payload: { taskId: input.task.id, statusId: input.body.statusId }
    });
  }

  if (
    workModelChanged ||
    !planningParticipantsSemanticallyEqual(input.task.participants, input.participants)
  ) {
    const currentAssignments = input.projectAssignments.filter(
      (assignment) => assignment.taskId === input.task.id
    );
    const assignmentWorkModel = workModelChanged
      ? {
          durationMinutes: desiredDurationMinutes,
          workMinutes: desiredWorkMinutes
        }
      : {
          durationMinutes:
            snapshotTask?.durationMinutes ?? input.task.durationWorkingDays * 480,
          workMinutes: snapshotTask?.workMinutes ?? input.task.plannedWork * 60
        };
    const desiredAssignments = preserveExistingAssignmentIds(
      currentAssignments,
      taskParticipantsToAssignments(input.task.id, input.participants, assignmentWorkModel),
      new Set(input.projectAssignments.map((assignment) => assignment.id))
    );

    commands.push(
      ...buildAssignmentSyncCommands({
        taskId: input.task.id,
        currentAssignments,
        desiredAssignments
      })
    );
  }

  return commands;
}

export function buildArchiveTaskPlanningCommand(taskId: string): PlanningCommand {
  return {
    type: "task.delete_or_archive",
    payload: { taskId, mode: "archive" }
  };
}

export function buildStatusTransitionPlanningCommand(input: {
  taskId: string;
  statusId: string;
}): PlanningCommand {
  return {
    type: "task.update_status",
    payload: { taskId: input.taskId, statusId: input.statusId }
  };
}

export function dateToPlanDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function taskParticipantsToAssignments(
  taskId: string,
  participants: TaskParticipantRecord[],
  workModel?: { durationMinutes: number; workMinutes: number }
): TaskPlanningAssignment[] {
  const planningParticipants = participants.filter(isPlanningParticipant);
  const workParticipants = planningParticipants.filter((participant) =>
    isWorkPlanningRole(participant.role)
  );
  const workParticipantUnits = distributeUnitsPermille(
    unitsPermilleForWorkModel(workModel),
    workParticipants.length
  );
  let workParticipantIndex = 0;

  return planningParticipants.map((participant) => {
    const isWorkRole = isWorkPlanningRole(participant.role);
    const unitsPermille = isWorkRole
      ? workParticipantUnits[workParticipantIndex++] ?? 1000
      : 1000;

    return {
      id: planningAssignmentId(taskId, participant.userId, participant.role),
      resourceId: participant.userId,
      role: participant.role,
      unitsPermille,
      workMinutes: null
    };
  });
}

function unitsPermilleForWorkModel(
  workModel: { durationMinutes: number; workMinutes: number } | undefined
): number {
  if (!workModel || workModel.durationMinutes <= 0 || workModel.workMinutes <= 0) {
    return 1000;
  }

  return Math.max(1, Math.round((workModel.workMinutes * 1000) / workModel.durationMinutes));
}

function distributeUnitsPermille(totalUnitsPermille: number, count: number): number[] {
  if (count <= 0) return [];

  const baseUnits = Math.floor(totalUnitsPermille / count);
  const remainder = totalUnitsPermille % count;

  return Array.from({ length: count }, (_, index) =>
    Math.max(1, baseUnits + (index < remainder ? 1 : 0))
  );
}

function isWorkPlanningRole(role: PlanAssignmentRole): boolean {
  return role === "executor" || role === "co_executor";
}

function isPlanningParticipant(
  participant: TaskParticipantRecord
): participant is PlanningParticipantRecord {
  return isPlanningParticipantRole(participant.role);
}

function isPlanningParticipantRole(role: string): role is PlanAssignmentRole {
  return planningParticipantRoles.has(role as PlanAssignmentRole);
}

function participantSemanticKey(participant: TaskParticipantRecord): string {
  return `${participant.userId}\u0000${participant.role}`;
}

export function planningParticipantsSemanticallyEqual(
  currentParticipants: TaskParticipantRecord[],
  desiredParticipants: TaskParticipantRecord[]
): boolean {
  const currentKeys = currentParticipants
    .filter(isPlanningParticipant)
    .map(participantSemanticKey)
    .sort();
  const desiredKeys = desiredParticipants
    .filter(isPlanningParticipant)
    .map(participantSemanticKey)
    .sort();
  return (
    currentKeys.length === desiredKeys.length &&
    desiredKeys.every((key, index) => key === currentKeys[index])
  );
}


function assignmentSemanticKey(assignment: {
  resourceId: string;
  role: PlanAssignmentRole;
}): string {
  return `${assignment.resourceId}\u0000${assignment.role}`;
}

function preserveExistingAssignmentIds(
  currentAssignments: readonly PlanAssignment[],
  desiredAssignments: TaskPlanningAssignment[],
  reservedIds: ReadonlySet<string>
): TaskPlanningAssignment[] {
  const currentByParticipant = new Map(
    currentAssignments.map((assignment) => [assignmentSemanticKey(assignment), assignment])
  );
  const allocatedIds = new Set(reservedIds);

  return desiredAssignments.map((desired) => {
    const current = currentByParticipant.get(assignmentSemanticKey(desired));
    if (current) {
      allocatedIds.add(current.id);
      return { ...desired, id: current.id };
    }

    const id = allocatePlanningAssignmentId(desired.id, allocatedIds);
    return { ...desired, id };
  });
}


function buildAssignmentSyncCommands(input: {
  taskId: string;
  currentAssignments: PlanAssignment[];
  desiredAssignments: TaskPlanningAssignment[];
}): PlanningCommand[] {
  const commands: PlanningCommand[] = [];
  const desiredIds = new Set(input.desiredAssignments.map((assignment) => assignment.id));
  const currentById = new Map(
    input.currentAssignments.map((assignment) => [assignment.id, assignment])
  );

  for (const desired of input.desiredAssignments) {
    const current = currentById.get(desired.id);
    if (
      !current ||
      current.resourceId !== desired.resourceId ||
      current.role !== desired.role ||
      current.unitsPermille !== desired.unitsPermille ||
      current.workMinutes !== desired.workMinutes
    ) {
      commands.push({
        type: "assignment.upsert",
        payload: {
          id: desired.id,
          taskId: input.taskId,
          resourceId: desired.resourceId,
          role: desired.role,
          unitsPermille: desired.unitsPermille,
          workMinutes: desired.workMinutes
        }
      });
    }
  }

  for (const current of input.currentAssignments) {
    if (!desiredIds.has(current.id)) {
      commands.push({
        type: "assignment.delete",
        payload: { assignmentId: current.id }
      });
    }
  }

  return commands;
}
