/**
 * Зеркало контракта API задач из apps/api/src/projectWorkParsers.ts.
 * Используется в Storybook для типизации форм create/edit без реального fetch.
 */

export const TASK_PRIORITIES = ["low", "normal", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUS_CATEGORIES = [
  "new",
  "waiting",
  "in_progress",
  "review",
  "done"
] as const;
export type TaskStatusCategory = (typeof TASK_STATUS_CATEGORIES)[number];

export const TASK_PARTICIPANT_ROLES = [
  "executor",
  "co_executor",
  "requester",
  "controller",
  "approver",
  "observer"
] as const;
export type TaskParticipantRole = (typeof TASK_PARTICIPANT_ROLES)[number];

export type TaskParticipantInput = {
  userId: string;
  role: TaskParticipantRole;
};

/** Тело POST /api/workspace/tasks и POST /api/workspace/projects/:projectId/tasks. */
export type CreateTaskBody = {
  id?: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  statusId?: string;
  /** ISO date YYYY-MM-DD (UTC). */
  plannedStart: string;
  /** ISO date YYYY-MM-DD (UTC). */
  plannedFinish: string;
  /** 1..1000. */
  durationWorkingDays: number;
  /** Часы, 1..10000. На бэке * 60 → workMinutes. */
  plannedWork: number;
  requiresAcceptance: boolean;
  participants: TaskParticipantInput[];
};

/** Тело PATCH /api/workspace/tasks/:taskId. */
export type UpdateTaskBody = Omit<CreateTaskBody, "id"> & {
  statusId: string;
  /** Optimistic lock — ISO instant. */
  clientUpdatedAt: string;
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  critical: "Критичный"
};

export const TASK_STATUS_CATEGORY_LABEL: Record<TaskStatusCategory, string> = {
  new: "Новая",
  waiting: "Ожидает",
  in_progress: "В работе",
  review: "Ревью",
  done: "Готово"
};

export const TASK_PARTICIPANT_ROLE_LABEL: Record<TaskParticipantRole, string> = {
  executor: "Исполнитель",
  co_executor: "Соисполнитель",
  requester: "Постановщик",
  controller: "Контролёр",
  approver: "Согласующий",
  observer: "Наблюдатель"
};
