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

export function buildCreateTaskPlanningCommand(input: {
  taskId: string;
  projectId: string;
  statusId: string;
  body: CreateTaskBody;
  participants: TaskParticipantRecord[];
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
      assignments: taskParticipantsToAssignments(input.taskId, input.participants)
    }
  };
}

export function buildUpdateTaskPlanningCommands(input: {
  task: TaskRecord;
  body: UpdateTaskBody;
  participants: TaskParticipantRecord[];
  snapshot: PlanSnapshot;
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

  if (
    desiredWorkMinutes !== (snapshotTask?.workMinutes ?? input.task.plannedWork * 60) ||
    desiredDurationMinutes !== (snapshotTask?.durationMinutes ?? input.task.durationWorkingDays * 480)
  ) {
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

  commands.push(
    ...buildAssignmentSyncCommands({
      taskId: input.task.id,
      currentAssignments: input.snapshot.assignments.filter(
        (assignment) => assignment.taskId === input.task.id
      ),
      desiredAssignments: taskParticipantsToAssignments(input.task.id, input.participants)
    })
  );

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
  participants: TaskParticipantRecord[]
): TaskPlanningAssignment[] {
  return participants.flatMap((participant) => {
    if (!isPlanningParticipantRole(participant.role)) return [];
    return [{
      id: taskAssignmentId(taskId, participant.userId, participant.role),
      resourceId: participant.userId,
      role: participant.role,
      unitsPermille: 1000,
      workMinutes: null
    }];
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

function isPlanningParticipantRole(role: string): role is PlanAssignmentRole {
  return planningParticipantRoles.has(role as PlanAssignmentRole);
}

function taskAssignmentId(taskId: string, userId: string, role: PlanAssignmentRole): string {
  return `${taskId}-${userId}-${role}`;
}
