import { parsePlanDate } from "@kiss-pm/domain";
import type {
  CreateTaskPayload,
  DependencyType,
  PlanningCommand,
  PlanAssignmentRole,
  PlanConstraintType,
  ScenarioTarget,
  TaskType
} from "@kiss-pm/domain";

export type PlanningCommandEnvelope = {
  command: PlanningCommand;
  clientPlanVersion: number;
  idempotencyKey?: string;
};

export type PlanningCommandEnvelopeParseResult =
  | { ok: true; value: PlanningCommandEnvelope }
  | { ok: false; error: string };

export type ScenarioPreviewEnvelope = {
  target: ScenarioTarget;
  clientPlanVersion: number;
};

const dependencyTypes = ["FS", "SS", "FF", "SF"] as const;
const assignmentRoles = ["executor", "co_executor", "controller", "approver", "observer"] as const;
const taskTypes = ["fixed_units", "fixed_work", "fixed_duration"] as const;
const constraintTypes = [
  "as_soon_as_possible",
  "start_no_earlier_than",
  "finish_no_later_than",
  "must_start_on",
  "must_finish_on"
] as const;

export function parsePlanningCommandEnvelope(input: unknown): PlanningCommandEnvelopeParseResult {
  if (!isObject(input)) return { ok: false, error: "planning_command_invalid" };
  const commandResult = parsePlanningCommand(input.command);
  if (!commandResult.ok) return commandResult;
  const clientPlanVersion = getInteger(input, "clientPlanVersion");
  if (clientPlanVersion === null || clientPlanVersion < 1) {
    return { ok: false, error: "plan_version_conflict" };
  }
  const idempotencyKey = parseIdempotencyKey(input);
  if (idempotencyKey === false) return { ok: false, error: "planning_command_invalid" };
  const value: PlanningCommandEnvelope = {
    command: commandResult.value,
    clientPlanVersion
  };
  if (idempotencyKey !== undefined) value.idempotencyKey = idempotencyKey;
  return {
    ok: true,
    value
  };
}

export function parseScenarioPreviewEnvelope(input: unknown):
  | { ok: true; value: ScenarioPreviewEnvelope }
  | { ok: false; error: string } {
  if (!isObject(input) || !isObject(input.target)) {
    return { ok: false, error: "planning_scenario_invalid" };
  }
  const clientPlanVersion = getInteger(input, "clientPlanVersion");
  const target = parseScenarioTarget(input.target);
  if (clientPlanVersion === null || clientPlanVersion < 1 || !target.ok) {
    return { ok: false, error: "planning_scenario_invalid" };
  }
  return { ok: true, value: { target: target.value, clientPlanVersion } };
}

export function parseScenarioApplyEnvelope(input: unknown):
  | { ok: true; value: { clientPlanVersion: number; acceptedRiskReason: string | null } }
  | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "planning_scenario_invalid" };
  const clientPlanVersion = getInteger(input, "clientPlanVersion");
  if (clientPlanVersion === null || clientPlanVersion < 1) {
    return { ok: false, error: "planning_scenario_invalid" };
  }
  return {
    ok: true,
    value: {
      clientPlanVersion,
      acceptedRiskReason: getOptionalString(input, "acceptedRiskReason")
    }
  };
}

export function parsePlanningCommand(input: unknown):
  | { ok: true; value: PlanningCommand }
  | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "planning_command_invalid" };
  const type = getString(input, "type");
  if (!type || !isObject(input.payload)) return { ok: false, error: "planning_command_invalid" };
  const payload = input.payload;

  switch (type) {
    case "task.create": {
      const id = getString(payload, "id");
      const projectId = getString(payload, "projectId");
      const title = getString(payload, "title");
      const statusId = getString(payload, "statusId");
      const plannedStart = getNullableDate(payload, "plannedStart");
      const plannedFinish = getNullableDate(payload, "plannedFinish");
      const durationMinutes = getNullableInteger(payload, "durationMinutes") ?? null;
      const workMinutes = getInteger(payload, "workMinutes");
      const assignments = parseCreateAssignments(payload.assignments);
      if (!id || !projectId || !title || !statusId || plannedStart === undefined || plannedFinish === undefined || workMinutes === null || workMinutes < 0 || !assignments.ok) {
        return { ok: false, error: "planning_command_invalid" };
      }
      if (durationMinutes !== null && durationMinutes <= 0) {
        return { ok: false, error: "planning_command_invalid" };
      }
      const createPayload: CreateTaskPayload = {
        id,
        projectId,
        title,
        statusId,
        plannedStart,
        plannedFinish,
        durationMinutes,
        workMinutes,
        assignments: assignments.value
      };
      const parentTaskId = getOptionalString(payload, "parentTaskId");
      if (parentTaskId !== null) createPayload.parentTaskId = parentTaskId;
      return { ok: true, value: { type, payload: createPayload } };
    }
    case "task.update_identity": {
      const taskId = getString(payload, "taskId");
      const title = getString(payload, "title");
      if (!taskId || !title) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { taskId, title } } };
    }
    case "task.update_schedule": {
      const taskId = getString(payload, "taskId");
      const plannedStart = getNullableDate(payload, "plannedStart");
      const plannedFinish = getNullableDate(payload, "plannedFinish");
      if (!taskId || plannedStart === undefined || plannedFinish === undefined) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { taskId, plannedStart, plannedFinish } } };
    }
    case "task.update_work_model": {
      const taskId = getString(payload, "taskId");
      const taskType = getString(payload, "taskType");
      const effortDriven = getBoolean(payload, "effortDriven");
      const durationMinutes = getNullableInteger(payload, "durationMinutes");
      const workMinutes = getInteger(payload, "workMinutes");
      if (!taskId || !isTaskType(taskType) || effortDriven === null || durationMinutes === undefined || workMinutes === null || workMinutes < 0) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { taskId, taskType, effortDriven, durationMinutes, workMinutes } } };
    }
    case "task.update_status": {
      const taskId = getString(payload, "taskId");
      const statusId = getString(payload, "statusId");
      if (!taskId || !statusId) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { taskId, statusId } } };
    }
    case "task.move_wbs": {
      const taskId = getString(payload, "taskId");
      const parentTaskId = getOptionalString(payload, "parentTaskId");
      const sortOrder = getInteger(payload, "sortOrder");
      if (!taskId || sortOrder === null || sortOrder < 0) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { taskId, parentTaskId, sortOrder } } };
    }
    case "task.delete_or_archive": {
      const taskId = getString(payload, "taskId");
      const mode = getString(payload, "mode");
      if (!taskId || (mode !== "archive" && mode !== "delete")) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { taskId, mode } } };
    }
    case "dependency.upsert": {
      const id = getString(payload, "id");
      const predecessorTaskId = getString(payload, "predecessorTaskId");
      const successorTaskId = getString(payload, "successorTaskId");
      const dependencyType = getString(payload, "dependencyType");
      const lagMinutes = getInteger(payload, "lagMinutes");
      if (!id || !predecessorTaskId || !successorTaskId || !isDependencyType(dependencyType) || lagMinutes === null) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, predecessorTaskId, successorTaskId, dependencyType, lagMinutes } } };
    }
    case "dependency.delete": {
      const dependencyId = getString(payload, "dependencyId");
      if (!dependencyId) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { dependencyId } } };
    }
    case "assignment.upsert": {
      const id = getString(payload, "id");
      const taskId = getString(payload, "taskId");
      const resourceId = getString(payload, "resourceId");
      const role = getString(payload, "role");
      const unitsPermille = getInteger(payload, "unitsPermille");
      const workMinutes = getNullableInteger(payload, "workMinutes");
      if (!id || !taskId || !resourceId || !isAssignmentRole(role) || unitsPermille === null || unitsPermille <= 0 || workMinutes === undefined) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, taskId, resourceId, role, unitsPermille, workMinutes } } };
    }
    case "assignment.delete": {
      const assignmentId = getString(payload, "assignmentId");
      if (!assignmentId) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { assignmentId } } };
    }
    case "baseline.capture": {
      const baselineId = getString(payload, "baselineId");
      const label = getString(payload, "label");
      if (!baselineId || !label) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { baselineId, label } } };
    }
    case "calendar.exception.upsert": {
      const id = getString(payload, "id");
      const calendarId = getString(payload, "calendarId");
      const resourceId = getOptionalString(payload, "resourceId");
      const date = getDate(payload, "date");
      const workingMinutes = getInteger(payload, "workingMinutes");
      if (!id || !calendarId || !date || workingMinutes === null || workingMinutes < 0) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, calendarId, resourceId, date, workingMinutes, reason: getOptionalString(payload, "reason") } } };
    }
    case "constraint.update": {
      const taskId = getString(payload, "taskId");
      const constraintId = getString(payload, "constraintId");
      const constraintType = getString(payload, "type");
      const date = getNullableDate(payload, "date");
      if (!taskId || !constraintId || !isConstraintType(constraintType) || date === undefined) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { taskId, constraintId, type: constraintType, date } } };
    }
    case "resource.reserve": {
      const id = getString(payload, "id");
      const resourceId = getString(payload, "resourceId");
      const start = getDate(payload, "start");
      const finish = getDate(payload, "finish");
      const workMinutes = getInteger(payload, "workMinutes");
      if (!id || !resourceId || !start || !finish || workMinutes === null || workMinutes < 0) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, resourceId, start, finish, workMinutes, reason: getOptionalString(payload, "reason") } } };
    }
    case "risk.accept_overload": {
      const overloadId = getString(payload, "overloadId");
      const acceptedRiskReason = getString(payload, "acceptedRiskReason");
      if (!overloadId || !acceptedRiskReason) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { overloadId, acceptedRiskReason } } };
    }
    case "project.deadline.move": {
      const deadline = getDate(payload, "deadline");
      const reason = getString(payload, "reason");
      if (!deadline || !reason) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { deadline, reason } } };
    }
    default:
      return { ok: false, error: "planning_command_invalid" };
  }
}

function parseCreateAssignments(input: unknown):
  | { ok: true; value: Array<{ id?: string; resourceId: string; role: PlanAssignmentRole; unitsPermille: number; workMinutes?: number | null }> }
  | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "planning_command_invalid" };
  const assignments = [];
  for (const item of input) {
    if (!isObject(item)) return { ok: false, error: "planning_command_invalid" };
    const resourceId = getString(item, "resourceId");
    const role = getString(item, "role");
    const unitsPermille = getInteger(item, "unitsPermille");
    const workMinutes = getNullableInteger(item, "workMinutes");
    if (!resourceId || !isAssignmentRole(role) || unitsPermille === null || unitsPermille <= 0 || workMinutes === undefined) {
      return { ok: false, error: "planning_command_invalid" };
    }
    const assignment: { id?: string; resourceId: string; role: PlanAssignmentRole; unitsPermille: number; workMinutes?: number | null } = {
      resourceId,
      role,
      unitsPermille,
      workMinutes
    };
    const id = getOptionalString(item, "id");
    if (id !== null) assignment.id = id;
    assignments.push(assignment);
  }
  return { ok: true, value: assignments };
}

function parseScenarioTarget(input: Record<string, unknown>):
  | { ok: true; value: ScenarioTarget }
  | { ok: false; error: string } {
  const type = getString(input, "type");
  const resourceId = getString(input, "resourceId");
  const date = getDate(input, "date");
  const overloadMinutes = getInteger(input, "overloadMinutes");
  if (
    type !== "resource_overload" ||
    !resourceId ||
    !date ||
    overloadMinutes === null ||
    overloadMinutes <= 0 ||
    !Array.isArray(input.taskIds)
  ) {
    return { ok: false, error: "planning_scenario_invalid" };
  }
  const taskIds = input.taskIds.map((item) =>
    typeof item === "string" && item.trim().length > 0 ? item.trim() : null
  );
  if (taskIds.some((taskId) => taskId === null)) {
    return { ok: false, error: "planning_scenario_invalid" };
  }
  return {
    ok: true,
    value: {
      type,
      resourceId,
      date,
      overloadMinutes,
      taskIds: taskIds as string[]
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getOptionalString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  if (value === null || value === undefined) return null;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseIdempotencyKey(input: Record<string, unknown>): string | undefined | false {
  const value = input.idempotencyKey;
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  return /^[A-Za-z0-9._:-]+$/.test(trimmed) ? trimmed : false;
}

function getInteger(input: Record<string, unknown>, key: string): number | null {
  const value = input[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function getNullableInteger(input: Record<string, unknown>, key: string): number | null | undefined {
  if (!(key in input)) return undefined;
  if (input[key] === null) return null;
  return getInteger(input, key);
}

function getBoolean(input: Record<string, unknown>, key: string): boolean | null {
  const value = input[key];
  return typeof value === "boolean" ? value : null;
}

function getDate(input: Record<string, unknown>, key: string): string | null {
  const value = getString(input, key);
  return value && isPlanDate(value) ? value : null;
}

function getNullableDate(input: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in input)) return undefined;
  if (input[key] === null) return null;
  return getDate(input, key) ?? undefined;
}

function isPlanDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    parsePlanDate(value);
    return true;
  } catch {
    return false;
  }
}

function isDependencyType(value: string | null): value is DependencyType {
  return dependencyTypes.includes(value as DependencyType);
}

function isAssignmentRole(value: string | null): value is PlanAssignmentRole {
  return assignmentRoles.includes(value as PlanAssignmentRole);
}

function isTaskType(value: string | null): value is TaskType {
  return taskTypes.includes(value as TaskType);
}

function isConstraintType(value: string | null): value is PlanConstraintType {
  return constraintTypes.includes(value as PlanConstraintType);
}
