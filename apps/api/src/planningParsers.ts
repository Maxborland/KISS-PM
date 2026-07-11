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

export type PlanningCommandBatchEnvelope = {
  commands: PlanningCommand[];
  clientPlanVersion: number;
  idempotencyKey?: string;
};

export type PlanningRevertEnvelope = {
  targetCommitId: string;
  clientPlanVersion: number;
  idempotencyKey: string;
};

export type PlanningCommandEnvelopeParseResult =
  | { ok: true; value: PlanningCommandEnvelope }
  | { ok: false; error: string };

export type PlanningCommandBatchEnvelopeParseResult =
  | { ok: true; value: PlanningCommandBatchEnvelope }
  | { ok: false; error: string };

export type PlanningRevertEnvelopeParseResult =
  | { ok: true; value: PlanningRevertEnvelope }
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
const maxPlanningStringLength = 500;
const maxAcceptedOverloadIdLength = maxPlanningStringLength + 11;
const maxTaskCustomFieldKeyLength = 120;
const maxTaskCustomFieldValueLength = 500;
const unsafeObjectKeys = new Set(["__proto__", "prototype", "constructor"]);

export function parsePlanningCommandEnvelope(input: unknown): PlanningCommandEnvelopeParseResult {
  if (!isObject(input)) return { ok: false, error: "planning_command_invalid" };
  const commandResult = parsePlanningCommand(input.command);
  if (!commandResult.ok) return commandResult;
  const envelopeFields = parseCommandEnvelopeFields(input);
  if (!envelopeFields.ok) return envelopeFields;
  const value: PlanningCommandEnvelope = {
    command: commandResult.value,
    clientPlanVersion: envelopeFields.value.clientPlanVersion
  };
  if (envelopeFields.value.idempotencyKey !== undefined) {
    value.idempotencyKey = envelopeFields.value.idempotencyKey;
  }
  return { ok: true, value };
}

export function parsePlanningCommandBatchEnvelope(
  input: unknown
): PlanningCommandBatchEnvelopeParseResult {
  if (!isObject(input)) return { ok: false, error: "planning_command_invalid" };
  if (!Array.isArray(input.commands) || input.commands.length === 0) {
    return { ok: false, error: "planning_command_invalid" };
  }
  const commands: PlanningCommand[] = [];
  for (const commandInput of input.commands) {
    const commandResult = parsePlanningCommand(commandInput);
    if (!commandResult.ok) return commandResult;
    commands.push(commandResult.value);
  }
  const envelopeFields = parseCommandEnvelopeFields(input);
  if (!envelopeFields.ok) return envelopeFields;
  const value: PlanningCommandBatchEnvelope = {
    commands,
    clientPlanVersion: envelopeFields.value.clientPlanVersion
  };
  if (envelopeFields.value.idempotencyKey !== undefined) {
    value.idempotencyKey = envelopeFields.value.idempotencyKey;
  }
  return { ok: true, value };
}

export function parsePlanningRevertEnvelope(input: unknown): PlanningRevertEnvelopeParseResult {
  if (!isObject(input)) return { ok: false, error: "planning_revert_invalid" };
  const targetCommitId = parsePersistedId(input.targetCommitId);
  const envelopeFields = parseCommandEnvelopeFields(input);
  if (
    targetCommitId === null ||
    !envelopeFields.ok ||
    envelopeFields.value.idempotencyKey === undefined
  ) {
    return { ok: false, error: "planning_revert_invalid" };
  }
  return {
    ok: true,
    value: {
      targetCommitId,
      clientPlanVersion: envelopeFields.value.clientPlanVersion,
      idempotencyKey: envelopeFields.value.idempotencyKey
    }
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
  const acceptedRiskReason = parseOptionalBoundedString(input, "acceptedRiskReason");
  if (!acceptedRiskReason.ok) return { ok: false, error: "planning_scenario_invalid" };
  return {
    ok: true,
    value: {
      clientPlanVersion,
      acceptedRiskReason: acceptedRiskReason.value
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
      const id = getPersistedId(payload, "id");
      const projectId = getPersistedId(payload, "projectId");
      const title = getString(payload, "title");
      const statusId = getPersistedId(payload, "statusId");
      const plannedStart = getNullableDate(payload, "plannedStart");
      const plannedFinish = getNullableDate(payload, "plannedFinish");
      const durationMinutes = getNullableInteger(payload, "durationMinutes") ?? null;
      const workMinutes = getInteger(payload, "workMinutes");
      const assignments = parseCreateAssignments(payload.assignments);
      if (!id || !projectId || !title || !statusId || plannedStart === undefined || plannedFinish === undefined || workMinutes === null || workMinutes < 0 || !assignments.ok) {
        return { ok: false, error: "planning_command_invalid" };
      }
      if (
        durationMinutes !== null &&
        (durationMinutes < 0 || (durationMinutes === 0 && workMinutes > 0))
      ) {
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
      const parentTaskId = getOptionalPersistedId(payload, "parentTaskId");
      if (parentTaskId === false) {
        return { ok: false, error: "planning_command_invalid" };
      }
      if (parentTaskId !== null) createPayload.parentTaskId = parentTaskId;
      return { ok: true, value: { type, payload: createPayload } };
    }
    case "task.update_identity": {
      const taskId = getPersistedId(payload, "taskId");
      const title = getString(payload, "title");
      if (!taskId || !title) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { taskId, title } } };
    }
    case "task.update_schedule": {
      const taskId = getPersistedId(payload, "taskId");
      const plannedStart = getNullableDate(payload, "plannedStart");
      const plannedFinish = getNullableDate(payload, "plannedFinish");
      if (!taskId || plannedStart === undefined || plannedFinish === undefined) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { taskId, plannedStart, plannedFinish } } };
    }
    case "task.update_work_model": {
      const taskId = getPersistedId(payload, "taskId");
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
      const taskId = getPersistedId(payload, "taskId");
      const statusId = getPersistedId(payload, "statusId");
      if (!taskId || !statusId) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { taskId, statusId } } };
    }
    case "task.update_progress": {
      const taskId = getPersistedId(payload, "taskId");
      const percentComplete = getInteger(payload, "percentComplete");
      if (
        !taskId ||
        percentComplete === null ||
        percentComplete < 0 ||
        percentComplete > 100
      ) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { taskId, percentComplete } } };
    }
    case "task.move_wbs": {
      const taskId = getPersistedId(payload, "taskId");
      const parentTaskId = getOptionalPersistedId(payload, "parentTaskId");
      const sortOrder = getInteger(payload, "sortOrder");
      if (!taskId || parentTaskId === false || sortOrder === null || sortOrder < 0) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { taskId, parentTaskId, sortOrder } } };
    }
    case "task.delete_or_archive": {
      const taskId = getPersistedId(payload, "taskId");
      const mode = getString(payload, "mode");
      if (!taskId || (mode !== "archive" && mode !== "delete")) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { taskId, mode } } };
    }
    case "dependency.upsert": {
      const id = getPersistedId(payload, "id");
      const predecessorTaskId = getPersistedId(payload, "predecessorTaskId");
      const successorTaskId = getPersistedId(payload, "successorTaskId");
      const dependencyType = getString(payload, "dependencyType");
      const lagMinutes = getInteger(payload, "lagMinutes");
      if (!id || !predecessorTaskId || !successorTaskId || !isDependencyType(dependencyType) || lagMinutes === null) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, predecessorTaskId, successorTaskId, dependencyType, lagMinutes } } };
    }
    case "dependency.delete": {
      const dependencyId = getPersistedId(payload, "dependencyId");
      if (!dependencyId) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { dependencyId } } };
    }
    case "assignment.upsert": {
      const id = getPersistedId(payload, "id");
      const taskId = getPersistedId(payload, "taskId");
      const resourceId = getPersistedId(payload, "resourceId");
      const role = getString(payload, "role");
      const unitsPermille = getInteger(payload, "unitsPermille");
      const workMinutes = getNullableInteger(payload, "workMinutes");
      if (!id || !taskId || !resourceId || !isAssignmentRole(role) || unitsPermille === null || unitsPermille <= 0 || workMinutes === undefined) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, taskId, resourceId, role, unitsPermille, workMinutes } } };
    }
    case "assignment.delete": {
      const assignmentId = getPersistedId(payload, "assignmentId");
      if (!assignmentId) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { assignmentId } } };
    }
    case "assignment.allocations.replace": {
      const assignmentId = getPersistedId(payload, "assignmentId");
      const allocations = parseAssignmentAllocations(payload.allocations);
      if (!assignmentId || !allocations.ok) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { assignmentId, allocations: allocations.value } } };
    }
    case "baseline.capture": {
      const baselineId = getPersistedId(payload, "baselineId");
      const label = getString(payload, "label");
      if (!baselineId || !label) return { ok: false, error: "planning_command_invalid" };
      return { ok: true, value: { type, payload: { baselineId, label } } };
    }
    case "calendar.exception.upsert": {
      const id = getPersistedId(payload, "id");
      const calendarId = getPersistedId(payload, "calendarId");
      const resourceId = getOptionalPersistedId(payload, "resourceId");
      const date = getDate(payload, "date");
      const workingMinutes = getInteger(payload, "workingMinutes");
      if (
        !id ||
        !calendarId ||
        resourceId === false ||
        !date ||
        workingMinutes === null ||
        workingMinutes < 0
      ) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, calendarId, resourceId, date, workingMinutes, reason: getOptionalString(payload, "reason") } } };
    }
    case "constraint.update": {
      const taskId = getPersistedId(payload, "taskId");
      const constraintId = getPersistedId(payload, "constraintId");
      const constraintType = getString(payload, "type");
      const date = getNullableDate(payload, "date");
      if (!taskId || !constraintId || !isConstraintType(constraintType) || date === undefined) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { taskId, constraintId, type: constraintType, date } } };
    }
    case "resource.reserve": {
      const id = getPersistedId(payload, "id");
      const resourceId = getPersistedId(payload, "resourceId");
      const start = getDate(payload, "start");
      const finish = getDate(payload, "finish");
      const workMinutes = getInteger(payload, "workMinutes");
      if (!id || !resourceId || !start || !finish || workMinutes === null || workMinutes < 0) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { id, resourceId, start, finish, workMinutes, reason: getOptionalString(payload, "reason") } } };
    }
    case "risk.accept_overload": {
      const overloadId = parseAcceptedOverloadId(payload.overloadId);
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
    case "project.settings.update": {
      const calendarId = getOptionalPersistedId(payload, "calendarId");
      if (calendarId === false) {
        return { ok: false, error: "planning_command_invalid" };
      }
      return { ok: true, value: { type, payload: { calendarId } } };
    }
    case "task.update_custom_field": {
      const taskId = getPersistedId(payload, "taskId");
      const fieldKey = parseTaskCustomFieldKey(payload.fieldKey);
      const value = parseTaskCustomFieldValue(payload.value);
      if (!taskId || !fieldKey || !value.ok) return { ok: false, error: "planning_command_invalid" };
      return {
        ok: true,
        value: { type, payload: { taskId, fieldKey, value: value.value } }
      };
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
    const resourceId = getPersistedId(item, "resourceId");
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
    const id = getOptionalPersistedId(item, "id");
    if (id === false) return { ok: false, error: "planning_command_invalid" };
    if (id !== null) assignment.id = id;
    assignments.push(assignment);
  }
  return { ok: true, value: assignments };
}

function parseAssignmentAllocations(input: unknown):
  | { ok: true; value: Array<{ date: string; workMinutes: number }> }
  | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "planning_command_invalid" };
  const allocations = [];
  const seenDates = new Set<string>();
  for (const item of input) {
    if (!isObject(item)) return { ok: false, error: "planning_command_invalid" };
    const date = getDate(item, "date");
    const workMinutes = getInteger(item, "workMinutes");
    if (!date || workMinutes === null || workMinutes <= 0 || seenDates.has(date)) {
      return { ok: false, error: "planning_command_invalid" };
    }
    seenDates.add(date);
    allocations.push({ date, workMinutes });
  }
  return { ok: true, value: allocations };
}

function parseScenarioTarget(input: Record<string, unknown>):
  | { ok: true; value: ScenarioTarget }
  | { ok: false; error: string } {
  const type = getString(input, "type");
  const resourceId = getPersistedId(input, "resourceId");
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
  const taskIds = input.taskIds.map((item) => parsePersistedId(item));
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
  return parseBoundedString(input[key]);
}
function parsePersistedId(value: unknown): string | null {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxPlanningStringLength &&
    /^[A-Za-z0-9._:-]+$/.test(value)
    ? value
    : null;
}

function parseAcceptedOverloadId(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    value.length > maxAcceptedOverloadIdLength ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    return null;
  }
  const separator = value.lastIndexOf(":");
  if (separator <= 0) return null;
  const resourceId = value.slice(0, separator);
  const date = value.slice(separator + 1);
  return parsePersistedId(resourceId) !== null && isPlanDate(date) ? value : null;
}

function getPersistedId(input: Record<string, unknown>, key: string): string | null {
  return parsePersistedId(input[key]);
}

function getOptionalPersistedId(
  input: Record<string, unknown>,
  key: string
): string | null | false {
  const value = input[key];
  if (value === null || value === undefined) return null;
  return parsePersistedId(value) ?? false;
}


function getOptionalString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  if (value === null || value === undefined) return null;
  return parseBoundedString(value);
}

function parseOptionalBoundedString(input: Record<string, unknown>, key: string):
  | { ok: true; value: string | null }
  | { ok: false } {
  if (!(key in input) || input[key] === null || input[key] === undefined) {
    return { ok: true, value: null };
  }
  if (typeof input[key] !== "string") return { ok: false };
  const raw = input[key];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  const value = parseBoundedString(raw);
  return value === null ? { ok: false } : { ok: true, value };
}

function parseCommandEnvelopeFields(input: Record<string, unknown>):
  | { ok: true; value: { clientPlanVersion: number; idempotencyKey?: string } }
  | { ok: false; error: string } {
  const clientPlanVersion = getInteger(input, "clientPlanVersion");
  if (clientPlanVersion === null || clientPlanVersion < 1) {
    return { ok: false, error: "plan_version_conflict" };
  }
  const idempotencyKey = parseIdempotencyKey(input);
  if (idempotencyKey === false) return { ok: false, error: "planning_command_invalid" };
  const value = { clientPlanVersion };
  if (idempotencyKey !== undefined) {
    return { ok: true, value: { ...value, idempotencyKey } };
  }
  return { ok: true, value };
}

function parseIdempotencyKey(input: Record<string, unknown>): string | undefined | false {
  const value = input.idempotencyKey;
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 120 ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    return false;
  }
  return value;
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

function parseBoundedString(value: unknown, maxLength: number = maxPlanningStringLength): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength || hasUnsafeSingleLineControl(trimmed)) {
    return null;
  }
  return trimmed;
}

function parseTaskCustomFieldKey(value: unknown): string | null {
  const key = parseBoundedString(value, maxTaskCustomFieldKeyLength);
  if (key === null || unsafeObjectKeys.has(key) || !/^[A-Za-z0-9_-]+$/.test(key)) return null;
  return key;
}

function parseTaskCustomFieldValue(value: unknown):
  | { ok: true; value: string | number | boolean | null }
  | { ok: false } {
  if (value === null || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (
      normalized.length > maxTaskCustomFieldValueLength ||
      hasUnsafeSingleLineControl(normalized)
    ) {
      return { ok: false };
    }
    return { ok: true, value: normalized };
  }
  return { ok: false };
}

function hasUnsafeSingleLineControl(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}
