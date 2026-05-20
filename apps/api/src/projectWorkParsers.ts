import { getOptionalString, getStringField } from "./parseHelpers";

const taskPriorities = ["low", "normal", "high", "critical"] as const;
const taskParticipantRoles = [
  "executor",
  "co_executor",
  "requester",
  "controller",
  "approver",
  "observer"
] as const;

export type CreateTaskBody = {
  id: string | undefined;
  title: string;
  description: string | null;
  priority: (typeof taskPriorities)[number];
  plannedStart: Date;
  plannedFinish: Date;
  plannedWork: number;
  participants: {
    userId: string;
    role: (typeof taskParticipantRoles)[number];
  }[];
};

export type CreateTaskParseResult =
  | { ok: true; value: CreateTaskBody }
  | { ok: false; error: string };

export type UpdateTaskStatusBody = {
  status: (typeof taskStatuses)[number];
};

export type UpdateTaskStatusParseResult =
  | { ok: true; value: UpdateTaskStatusBody }
  | { ok: false; error: string };

const taskStatuses = ["todo", "in_progress", "blocked", "done"] as const;

export function parseCreateTaskBody(input: unknown): CreateTaskParseResult {
  const id = getOptionalString(input, "id") ?? undefined;
  const title = getStringField(input, "title") ?? "";
  if (title.length < 3 || title.length > 160) {
    return { ok: false, error: "invalid_task_title" };
  }

  const plannedStart = parseDateField(input, "plannedStart");
  const plannedFinish = parseDateField(input, "plannedFinish");
  if (!plannedStart || !plannedFinish || plannedFinish < plannedStart) {
    return { ok: false, error: "invalid_task_dates" };
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
      description: getOptionalString(input, "description"),
      priority,
      plannedStart,
      plannedFinish,
      plannedWork,
      participants: participants.value
    }
  };
}

export function parseUpdateTaskStatusBody(
  input: unknown
): UpdateTaskStatusParseResult {
  const status = getStringField(input, "status") ?? "";
  if (!isTaskStatus(status)) {
    return { ok: false, error: "invalid_task_status" };
  }

  return { ok: true, value: { status } };
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
    if (userId.length < 3 || userId.length > 120) {
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

function getIntegerField(input: unknown, key: string): number | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

function isTaskPriority(value: string): value is CreateTaskBody["priority"] {
  return taskPriorities.includes(value as CreateTaskBody["priority"]);
}

function isTaskStatus(value: string): value is UpdateTaskStatusBody["status"] {
  return taskStatuses.includes(value as UpdateTaskStatusBody["status"]);
}

function isTaskParticipantRole(
  value: string
): value is CreateTaskBody["participants"][number]["role"] {
  return taskParticipantRoles.includes(
    value as CreateTaskBody["participants"][number]["role"]
  );
}
