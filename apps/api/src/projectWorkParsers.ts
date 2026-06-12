import { getOptionalString, getStringField } from "./parseHelpers";
export type { RouteParamParseResult as ProjectWorkRouteIdParseResult } from "./routeParamParsers";
export {
  parseProjectIdParam,
  parseProjectTaskStageIdParam,
  parseTaskIdParam,
  parseTaskStatusIdParam
} from "./routeParamParsers";

const projectStatusUpdateStatuses = ["active", "paused"] as const;
const taskPriorities = ["low", "normal", "high", "critical"] as const;
const taskStatusCategories = [
  "new",
  "waiting",
  "in_progress",
  "review",
  "done"
] as const;
const taskParticipantRoles = [
  "executor",
  "co_executor",
  "requester",
  "controller",
  "approver",
  "observer"
] as const;
const maxTaskDescriptionLength = 4000;

export type UpdateProjectStatusBody = {
  status: (typeof projectStatusUpdateStatuses)[number];
};

export type UpdateProjectStatusParseResult =
  | { ok: true; value: UpdateProjectStatusBody }
  | { ok: false; error: string };

export type CreateTaskBody = {
  id: string | undefined;
  title: string;
  description: string | null;
  priority: (typeof taskPriorities)[number];
  statusId: string | undefined;
  plannedStart: Date;
  plannedFinish: Date;
  durationWorkingDays: number;
  plannedWork: number;
  requiresAcceptance: boolean;
  participants: {
    userId: string;
    role: (typeof taskParticipantRoles)[number];
  }[];
};

export type CreateTaskParseResult =
  | { ok: true; value: CreateTaskBody }
  | { ok: false; error: string };

export type UpdateTaskStatusBody = {
  statusId: string;
};

export type UpdateTaskStatusParseResult =
  | { ok: true; value: UpdateTaskStatusBody }
  | { ok: false; error: string };

export type UpdateTaskBody = Omit<CreateTaskBody, "id"> & {
  statusId: string;
  clientUpdatedAt: Date;
};

export type UpdateTaskParseResult =
  | { ok: true; value: UpdateTaskBody }
  | { ok: false; error: string };

export type CreateTaskStatusBody = {
  id: string;
  name: string;
  category: (typeof taskStatusCategories)[number];
  sortOrder: number;
  status: "active" | "archived";
};

export type ProjectTaskStageWriteBody = {
  id: string;
  name: string;
  sortOrder: number;
  status: "active" | "archived";
};

export type CreateTaskStatusParseResult =
  | { ok: true; value: CreateTaskStatusBody }
  | { ok: false; error: string };

export type ProjectTaskStageWriteParseResult =
  | { ok: true; value: ProjectTaskStageWriteBody }
  | { ok: false; error: string };

export type TaskCommentBody = {
  body: string;
};

export type TaskCommentParseResult =
  | { ok: true; value: TaskCommentBody }
  | { ok: false; error: string };

export function parseUpdateProjectStatusBody(
  input: unknown
): UpdateProjectStatusParseResult {
  const status = getStringField(input, "status") ?? "";
  if (!isProjectLifecycleStatus(status)) {
    return { ok: false, error: "invalid_project_status" };
  }

  return { ok: true, value: { status } };
}

export function parseCreateTaskBody(input: unknown): CreateTaskParseResult {
  const id = getOptionalString(input, "id") ?? undefined;
  const title = getStringField(input, "title") ?? "";
  if (title.length < 3 || title.length > 160 || !isSafeSingleLineText(title)) {
    return { ok: false, error: "invalid_task_title" };
  }
  const description = getOptionalString(input, "description");
  if (
    description !== null &&
    (description.length > maxTaskDescriptionLength || !isSafeMultilineText(description))
  ) {
    return { ok: false, error: "invalid_task_description" };
  }

  const plannedStart = parseDateField(input, "plannedStart");
  const plannedFinish = parseDateField(input, "plannedFinish");
  if (!plannedStart || !plannedFinish || plannedFinish < plannedStart) {
    return { ok: false, error: "invalid_task_dates" };
  }

  const durationWorkingDays = getIntegerField(input, "durationWorkingDays") ?? 1;
  if (durationWorkingDays < 1 || durationWorkingDays > 1000) {
    return { ok: false, error: "invalid_task_duration" };
  }

  const plannedWork = getIntegerField(input, "plannedWork");
  if (plannedWork === null || plannedWork < 1 || plannedWork > 10000) {
    return { ok: false, error: "invalid_task_planned_work" };
  }

  const priority = getStringField(input, "priority") ?? "normal";
  if (!isTaskPriority(priority)) {
    return { ok: false, error: "invalid_task_priority" };
  }

  const participants = parseParticipants(input);
  if (!participants.ok) return participants;
  if (!participants.value.some((participant) => participant.role === "executor")) {
    return { ok: false, error: "task_executor_required" };
  }

  return {
    ok: true,
    value: {
      id,
      title,
      description,
      priority,
      statusId: getOptionalString(input, "statusId") ?? undefined,
      plannedStart,
      plannedFinish,
      durationWorkingDays,
      plannedWork,
      requiresAcceptance: getBooleanField(input, "requiresAcceptance") ?? false,
      participants: participants.value
    }
  };
}

export function parseUpdateTaskBody(input: unknown): UpdateTaskParseResult {
  const parsed = parseCreateTaskBody(input);
  if (!parsed.ok) return parsed;

  const statusId = getOptionalString(input, "statusId");
  if (!statusId) return { ok: false, error: "invalid_task_status" };
  const clientUpdatedAt = parseInstantField(input, "clientUpdatedAt");
  if (!clientUpdatedAt) return { ok: false, error: "invalid_task_version" };

  return {
    ok: true,
    value: {
      ...parsed.value,
      statusId,
      clientUpdatedAt
    }
  };
}

export function parseUpdateTaskStatusBody(
  input: unknown
): UpdateTaskStatusParseResult {
  const status = getStringField(input, "status") ?? "";
  const statusId = getOptionalString(input, "statusId") ?? status;
  if (!isSafeIdentifier(statusId) || statusId === "cancelled") {
    return { ok: false, error: "invalid_task_status" };
  }

  return { ok: true, value: { statusId } };
}

export function parseCreateTaskStatusBody(
  input: unknown
): CreateTaskStatusParseResult {
  const id = getOptionalString(input, "id");
  if (!id || !isSafeIdentifier(id)) {
    return { ok: false, error: "invalid_task_status_id" };
  }
  const name = getStringField(input, "name") ?? "";
  if (name.length < 2 || name.length > 80 || !isSafeSingleLineText(name)) {
    return { ok: false, error: "invalid_task_status_name" };
  }
  const category = getStringField(input, "category") ?? "";
  if (!isTaskStatusCategory(category)) {
    return { ok: false, error: "invalid_task_status_category" };
  }
  const sortOrder = getIntegerField(input, "sortOrder");
  if (sortOrder === null || sortOrder < 1 || sortOrder > 10000) {
    return { ok: false, error: "invalid_task_status_sort_order" };
  }
  const status = getOptionalString(input, "status") ?? "active";
  if (status !== "active" && status !== "archived") {
    return { ok: false, error: "invalid_task_status_state" };
  }

  return {
    ok: true,
    value: {
      id,
      name,
      category,
      sortOrder,
      status
    }
  };
}

export function parseProjectTaskStageWriteBody(
  input: unknown
): ProjectTaskStageWriteParseResult {
  const id = getOptionalString(input, "id");
  if (!id || !isSafeIdentifier(id)) {
    return { ok: false, error: "invalid_project_task_stage_id" };
  }
  const name = getStringField(input, "name") ?? "";
  if (name.length < 2 || name.length > 80 || !isSafeSingleLineText(name)) {
    return { ok: false, error: "invalid_project_task_stage_name" };
  }
  const sortOrder = getIntegerField(input, "sortOrder");
  if (sortOrder === null || sortOrder < 1 || sortOrder > 10000) {
    return { ok: false, error: "invalid_project_task_stage_sort_order" };
  }
  const status = getOptionalString(input, "status") ?? "active";
  if (status !== "active" && status !== "archived") {
    return { ok: false, error: "invalid_project_task_stage_state" };
  }

  return {
    ok: true,
    value: {
      id,
      name,
      sortOrder,
      status
    }
  };
}

export function parseTaskCommentBody(input: unknown): TaskCommentParseResult {
  const body = getStringField(input, "body") ?? "";
  if (body.length < 1 || body.length > 4000 || !isSafeMultilineText(body)) {
    return { ok: false, error: "invalid_task_comment" };
  }
  return { ok: true, value: { body } };
}

function parseParticipants(
  input: unknown
):
  | { ok: true; value: CreateTaskBody["participants"] }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "task_executor_required" };
  }

  const rawParticipants = (input as Record<string, unknown>).participants;
  if (!Array.isArray(rawParticipants) || rawParticipants.length === 0) {
    return { ok: false, error: "task_executor_required" };
  }
  if (rawParticipants.length > 20) {
    return { ok: false, error: "too_many_task_participants" };
  }

  const participants: CreateTaskBody["participants"] = [];
  const participantKeys = new Set<string>();
  for (const rawParticipant of rawParticipants) {
    if (!rawParticipant || typeof rawParticipant !== "object") {
      return { ok: false, error: "invalid_task_participant" };
    }
    const userId = getStringField(rawParticipant, "userId") ?? "";
    const role = getStringField(rawParticipant, "role") ?? "";
    if (!isSafeIdentifier(userId)) {
      return { ok: false, error: "invalid_task_participant" };
    }
    if (!isTaskParticipantRole(role)) {
      return { ok: false, error: "invalid_task_participant_role" };
    }
    const key = `${userId}:${role}`;
    if (participantKeys.has(key)) {
      return { ok: false, error: "duplicate_task_participant" };
    }
    participantKeys.add(key);
    participants.push({ userId, role });
  }

  return { ok: true, value: participants };
}

function parseDateField(input: unknown, key: string): Date | null {
  const value = getStringField(input, key);
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseInstantField(input: unknown, key: string): Date | null {
  const value = getStringField(input, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getIntegerField(input: unknown, key: string): number | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

function getBooleanField(input: unknown, key: string): boolean | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  if (typeof value !== "boolean") return null;
  return value;
}

function isProjectLifecycleStatus(
  value: string
): value is UpdateProjectStatusBody["status"] {
  return projectStatusUpdateStatuses.includes(value as UpdateProjectStatusBody["status"]);
}

function isTaskPriority(value: string): value is CreateTaskBody["priority"] {
  return taskPriorities.includes(value as CreateTaskBody["priority"]);
}

function isTaskParticipantRole(
  value: string
): value is CreateTaskBody["participants"][number]["role"] {
  return taskParticipantRoles.includes(
    value as CreateTaskBody["participants"][number]["role"]
  );
}

function isTaskStatusCategory(
  value: string
): value is CreateTaskStatusBody["category"] {
  return taskStatusCategories.includes(value as CreateTaskStatusBody["category"]);
}

function isSafeIdentifier(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{2,119}$/.test(value);
}

function isSafeSingleLineText(value: string): boolean {
  return !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeMultilineText(value: string): boolean {
  return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
