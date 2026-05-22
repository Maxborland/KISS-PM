import type {
  DependencyType,
  PlanAssignmentRole,
  PlanConstraintType,
  PlanDate,
  PlanSnapshot,
  TaskType,
  ValidationIssue
} from "./types";

export type CreateTaskPayload = {
  id: string;
  projectId: string;
  parentTaskId?: string | null;
  title: string;
  statusId: string;
  plannedStart: PlanDate | null;
  plannedFinish: PlanDate | null;
  workMinutes: number;
  assignments: Array<{
    id?: string;
    resourceId: string;
    role: PlanAssignmentRole;
    unitsPermille: number;
    workMinutes?: number | null;
  }>;
};

export type PlanningCommand =
  | { type: "task.create"; payload: CreateTaskPayload }
  | { type: "task.update_identity"; payload: { taskId: string; title: string } }
  | {
      type: "task.update_schedule";
      payload: {
        taskId: string;
        plannedStart: PlanDate | null;
        plannedFinish: PlanDate | null;
      };
    }
  | {
      type: "task.update_work_model";
      payload: {
        taskId: string;
        taskType: TaskType;
        effortDriven: boolean;
        durationMinutes: number | null;
        workMinutes: number;
      };
    }
  | { type: "task.update_status"; payload: { taskId: string; statusId: string } }
  | {
      type: "task.move_wbs";
      payload: { taskId: string; parentTaskId: string | null; sortOrder: number };
    }
  | { type: "task.delete_or_archive"; payload: { taskId: string; mode: "archive" | "delete" } }
  | {
      type: "dependency.upsert";
      payload: {
        id: string;
        predecessorTaskId: string;
        successorTaskId: string;
        dependencyType: DependencyType;
        lagMinutes: number;
      };
    }
  | { type: "dependency.delete"; payload: { dependencyId: string } }
  | {
      type: "assignment.upsert";
      payload: {
        id: string;
        taskId: string;
        resourceId: string;
        role: PlanAssignmentRole;
        unitsPermille: number;
        workMinutes: number | null;
      };
    }
  | { type: "assignment.delete"; payload: { assignmentId: string } }
  | { type: "baseline.capture"; payload: { baselineId: string; label: string } }
  | {
      type: "calendar.exception.upsert";
      payload: {
        id: string;
        calendarId: string;
        resourceId: string | null;
        date: PlanDate;
        workingMinutes: number;
        reason: string | null;
      };
    }
  | {
      type: "constraint.update";
      payload: {
        taskId: string;
        constraintId: string;
        type: PlanConstraintType;
        date: PlanDate | null;
      };
    }
  | {
      type: "resource.reserve";
      payload: {
        id: string;
        resourceId: string;
        start: PlanDate;
        finish: PlanDate;
        workMinutes: number;
        reason: string | null;
      };
    }
  | {
      type: "risk.accept_overload";
      payload: { overloadId: string; acceptedRiskReason: string };
    }
  | { type: "project.deadline.move"; payload: { deadline: PlanDate; reason: string } };

export type PlanDelta = {
  commands: PlanningCommand[];
  changedTaskIds: string[];
  changedAssignmentIds: string[];
  changedDependencyIds: string[];
  acceptedRiskIds: string[];
};

export function createPlanningCommand(command: PlanningCommand): PlanningCommand {
  return command;
}

export function createEmptyPlanDelta(): PlanDelta {
  return {
    commands: [],
    changedTaskIds: [],
    changedAssignmentIds: [],
    changedDependencyIds: [],
    acceptedRiskIds: []
  };
}

export function isBlockingValidationIssue(issue: ValidationIssue): boolean {
  return issue.severity === "error";
}

export type { PlanSnapshot, ValidationIssue };
