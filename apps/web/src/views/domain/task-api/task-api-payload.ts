import type {
  CreateTaskBody,
  TaskParticipantInput,
  TaskPriority,
  UpdateTaskBody
} from "./task-api-contract";
import { formatPlanDate } from "./task-api-validation";

/** Форма мастера создания задачи (плоская — собирается из useState). */
export type CreateTaskFormState = {
  title: string;
  description: string;
  priority: TaskPriority;
  statusId: string;
  plannedStart: Date | undefined;
  plannedFinish: Date | undefined;
  durationWorkingDays: number;
  plannedWork: number;
  requiresAcceptance: boolean;
  participants: TaskParticipantInput[];
};

export type CreateTaskRequestPreview = {
  /** Описание endpoint в RU — для JSON preview панели. */
  endpointLabel: string;
  /** Реальный URL вызова. */
  url: string;
  method: "POST";
  body: CreateTaskBody;
};

export type UpdateTaskFormState = CreateTaskFormState & {
  statusId: string;
  clientUpdatedAt: string;
};

export type UpdateTaskRequestPreview = {
  endpointLabel: string;
  url: string;
  method: "PATCH";
  body: UpdateTaskBody;
};

export function buildCreateTaskBody(form: CreateTaskFormState): CreateTaskBody {
  const body: CreateTaskBody = {
    title: form.title.trim(),
    description: form.description.trim() ? form.description.trim() : null,
    priority: form.priority,
    plannedStart: formatPlanDate(form.plannedStart),
    plannedFinish: formatPlanDate(form.plannedFinish),
    durationWorkingDays: form.durationWorkingDays,
    plannedWork: form.plannedWork,
    requiresAcceptance: form.requiresAcceptance,
    participants: form.participants
  };
  if (form.statusId) body.statusId = form.statusId;
  return body;
}

export function buildCreateTaskPreview(
  form: CreateTaskFormState,
  context: { projectId?: string }
): CreateTaskRequestPreview {
  const url = context.projectId
    ? `/api/workspace/projects/${context.projectId}/tasks`
    : "/api/workspace/tasks";
  const endpointLabel = context.projectId
    ? `Создать задачу в проекте ${context.projectId}`
    : "Создать задачу в Inbox арендатора";
  return {
    endpointLabel,
    url,
    method: "POST",
    body: buildCreateTaskBody(form)
  };
}

export function buildUpdateTaskBody(form: UpdateTaskFormState): UpdateTaskBody {
  return {
    title: form.title.trim(),
    description: form.description.trim() ? form.description.trim() : null,
    priority: form.priority,
    statusId: form.statusId,
    plannedStart: formatPlanDate(form.plannedStart),
    plannedFinish: formatPlanDate(form.plannedFinish),
    durationWorkingDays: form.durationWorkingDays,
    plannedWork: form.plannedWork,
    requiresAcceptance: form.requiresAcceptance,
    participants: form.participants,
    clientUpdatedAt: form.clientUpdatedAt
  };
}

export function buildUpdateTaskPreview(
  form: UpdateTaskFormState,
  context: { taskId: string }
): UpdateTaskRequestPreview {
  return {
    endpointLabel: `Обновить задачу ${context.taskId}`,
    url: `/api/workspace/tasks/${context.taskId}`,
    method: "PATCH",
    body: buildUpdateTaskBody(form)
  };
}
