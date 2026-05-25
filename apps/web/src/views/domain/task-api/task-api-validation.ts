import {
  TASK_PARTICIPANT_ROLES,
  TASK_PRIORITIES,
  type CreateTaskBody,
  type TaskParticipantInput,
  type TaskPriority,
  type UpdateTaskBody
} from "./task-api-contract";

/** Коды ошибок, которые возвращает projectWorkParsers.ts. */
export type TaskApiErrorCode =
  | "invalid_task_title"
  | "invalid_task_dates"
  | "invalid_task_duration"
  | "invalid_task_planned_work"
  | "invalid_task_priority"
  | "invalid_task_status"
  | "invalid_task_version"
  | "task_executor_required"
  | "invalid_task_participant"
  | "invalid_task_participant_role"
  | "duplicate_task_participant"
  | "too_many_task_participants";

export const TASK_API_ERROR_RU: Record<TaskApiErrorCode, string> = {
  invalid_task_title: "Название: от 3 до 160 символов",
  invalid_task_dates: "Проверьте даты начала и окончания",
  invalid_task_duration: "Длительность: 1–1000 раб. дней",
  invalid_task_planned_work: "Трудозатраты: 1–10 000 часов",
  invalid_task_priority: "Недопустимый приоритет",
  invalid_task_status: "Недопустимый статус",
  invalid_task_version: "Конфликт версии — обновите карточку",
  task_executor_required: "Укажите исполнителя",
  invalid_task_participant: "Недопустимый участник",
  invalid_task_participant_role: "Недопустимая роль участника",
  duplicate_task_participant: "Участник дублируется",
  too_many_task_participants: "Не более 20 участников"
};

export type TaskFieldKey =
  | "title"
  | "plannedStart"
  | "plannedFinish"
  | "durationWorkingDays"
  | "plannedWork"
  | "priority"
  | "participants"
  | "statusId";

export type TaskValidationIssue = {
  field: TaskFieldKey;
  code: TaskApiErrorCode;
  message: string;
};

/** Перевод даты в формат API (`YYYY-MM-DD`, UTC). */
export function formatPlanDate(value: Date | undefined | null): string {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPlanDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function issue(field: TaskFieldKey, code: TaskApiErrorCode): TaskValidationIssue {
  return { field, code, message: TASK_API_ERROR_RU[code] };
}

/** Валидация перед сборкой CreateTaskBody. Логика повторяет parseCreateTaskBody. */
export function validateCreateTaskInput(input: CreateTaskBody): TaskValidationIssue[] {
  const issues: TaskValidationIssue[] = [];

  if (input.title.trim().length < 3 || input.title.trim().length > 160) {
    issues.push(issue("title", "invalid_task_title"));
  }

  if (!isPlanDate(input.plannedStart) || !isPlanDate(input.plannedFinish)) {
    issues.push(issue("plannedStart", "invalid_task_dates"));
  } else if (input.plannedFinish < input.plannedStart) {
    issues.push(issue("plannedFinish", "invalid_task_dates"));
  }

  if (
    !Number.isInteger(input.durationWorkingDays) ||
    input.durationWorkingDays < 1 ||
    input.durationWorkingDays > 1000
  ) {
    issues.push(issue("durationWorkingDays", "invalid_task_duration"));
  }

  if (
    !Number.isInteger(input.plannedWork) ||
    input.plannedWork < 1 ||
    input.plannedWork > 10000
  ) {
    issues.push(issue("plannedWork", "invalid_task_planned_work"));
  }

  if (!isTaskPriority(input.priority)) {
    issues.push(issue("priority", "invalid_task_priority"));
  }

  const participantsIssue = validateParticipants(input.participants);
  if (participantsIssue) issues.push(participantsIssue);

  return issues;
}

export function validateUpdateTaskInput(input: UpdateTaskBody): TaskValidationIssue[] {
  const issues = validateCreateTaskInput(input);
  if (!input.statusId) issues.push(issue("statusId", "invalid_task_status"));
  return issues;
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value as string);
}

function validateParticipants(
  participants: TaskParticipantInput[]
): TaskValidationIssue | null {
  if (!Array.isArray(participants) || participants.length === 0) {
    return issue("participants", "task_executor_required");
  }
  if (participants.length > 20) {
    return issue("participants", "too_many_task_participants");
  }
  const seen = new Set<string>();
  for (const p of participants) {
    if (!p.userId || p.userId.length < 3 || p.userId.length > 120) {
      return issue("participants", "invalid_task_participant");
    }
    if (!(TASK_PARTICIPANT_ROLES as readonly string[]).includes(p.role)) {
      return issue("participants", "invalid_task_participant_role");
    }
    const key = `${p.userId}:${p.role}`;
    if (seen.has(key)) return issue("participants", "duplicate_task_participant");
    seen.add(key);
  }
  if (!participants.some((p) => p.role === "executor")) {
    return issue("participants", "task_executor_required");
  }
  return null;
}

/** Сводит issues к { fieldKey: message } — удобно для render-времени. */
export function issuesToFieldMap(
  issues: TaskValidationIssue[]
): Partial<Record<TaskFieldKey, string>> {
  const result: Partial<Record<TaskFieldKey, string>> = {};
  for (const i of issues) {
    if (!result[i.field]) result[i.field] = i.message;
  }
  return result;
}
