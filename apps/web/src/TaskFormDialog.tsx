"use client";

import { useEffect, useMemo, useState } from "react";

import type { Task, TaskInput, TaskParticipant, TaskStatusDefinition, TaskUpdateInput } from "./api";
import { DatePickerField } from "./components/DatePickerField";
import { FieldError, Modal } from "./components/workspace-ui";
import {
  getPriorityLabel,
  getRoleLabel,
  sortTaskStatuses
} from "./taskWorkspace";
import type { WorkspaceData } from "./workspaceData";

type TaskFormErrors = Record<string, string>;

export function TaskFormDialog(props: {
  data: WorkspaceData;
  task?: Task | undefined;
  projectId?: string | undefined;
  taskStatuses: readonly TaskStatusDefinition[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: TaskInput | TaskUpdateInput, projectId: string) => Promise<void>;
}) {
  const formId = props.task ? "task-edit-form" : "task-create-form";
  const activeStatuses = useMemo(
    () => sortTaskStatuses(props.taskStatuses),
    [props.taskStatuses]
  );
  const activeUsers = useMemo(
    () =>
      (props.data.users.length > 0 ? props.data.users : [props.data.me]).filter(
        (user) => user.status !== "inactive"
      ),
    [props.data.me, props.data.users]
  );
  const defaultStatusId =
    props.task?.statusId ??
    activeStatuses.find((status) => status.category === "new")?.id ??
    activeStatuses[0]?.id ??
    "";
  const [plannedStart, setPlannedStart] = useState(props.task?.plannedStart ?? "");
  const [plannedFinish, setPlannedFinish] = useState(props.task?.plannedFinish ?? "");
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const initialExecutorId =
    props.task?.ownerUserId ??
    props.task?.participants.find((participant) => participant.role === "executor")?.userId ??
    props.data.me.id;
  const initialRequesterId = props.task?.requesterUserId ?? props.data.me.id;
  const initialCoExecutors = new Set(
    props.task?.participants
      .filter((participant) => participant.role === "co_executor")
      .map((participant) => participant.userId) ?? []
  );
  const initialObservers = new Set(
    props.task?.participants
      .filter((participant) => participant.role === "observer")
      .map((participant) => participant.userId) ?? []
  );

  useEffect(() => {
    setErrors({});
    setSubmitError("");
    setPlannedStart(props.task?.plannedStart ?? "");
    setPlannedFinish(props.task?.plannedFinish ?? "");
  }, [props.task?.id]);

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const projectId = props.projectId ?? props.task?.projectId ?? String(form.get("projectId") ?? "");
    const statusId = String(form.get("statusId") ?? defaultStatusId);
    const requesterId = String(form.get("requesterId") ?? props.data.me.id);
    const executorId = String(form.get("executorId") ?? "");
    const participants = buildParticipants({
      requesterId,
      executorId,
      coExecutorIds: form.getAll("coExecutorIds").map(String),
      observerIds: form.getAll("observerIds").map(String)
    });

    const input: TaskInput | TaskUpdateInput = {
      id: props.task ? undefined : String(form.get("id") ?? "").trim() || undefined,
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      priority: String(form.get("priority") ?? "normal") as Task["priority"],
      statusId,
      plannedStart,
      plannedFinish,
      durationWorkingDays: Number(form.get("durationWorkingDays") ?? 0),
      plannedWork: Number(form.get("plannedWork") ?? 0),
      requiresAcceptance: form.get("requiresAcceptance") === "on",
      participants
    };
    const validationErrors = validateTaskForm(input, projectId);
    setErrors(validationErrors);
    setSubmitError("");
    if (Object.keys(validationErrors).length > 0) return;

    try {
      await props.onSubmit(input, projectId);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось сохранить задачу.");
    }
  }

  return (
    <Modal
      title={props.task ? "Редактировать задачу" : "Создать задачу"}
      description="Поля проверяются правами и записываются в аудит. Предшественники задаются в Gantt."
      isDismissDisabled={props.isPending}
      size="wide"
      onClose={props.onClose}
    >
      <form className="task-form-grid" noValidate onSubmit={submitTask}>
        <section className="task-form-section">
          <h3>1. Основное</h3>
          {!props.task ? (
            <label>
              Код задачи
              <input name="id" placeholder="TASK-849160" />
            </label>
          ) : null}
          <div className="form-grid">
            <label>
              Название <span aria-hidden="true">*</span>
              <input
                aria-describedby={errors.title ? `${formId}-title-error` : undefined}
                aria-invalid={Boolean(errors.title)}
                data-autofocus
                defaultValue={props.task?.title ?? ""}
                name="title"
                placeholder="Например, подготовить ресурсную оценку"
              />
              <FieldError errors={errors} field="title" formId={formId} />
            </label>
            <label>
              Статус <span aria-hidden="true">*</span>
              <select
                aria-describedby={errors.statusId ? `${formId}-statusId-error` : undefined}
                aria-invalid={Boolean(errors.statusId)}
                defaultValue={defaultStatusId}
                name="statusId"
              >
                {activeStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
              <small>Новая и Выполнено обязательные; остальные статусы настраиваются.</small>
              <FieldError errors={errors} field="statusId" formId={formId} />
            </label>
          </div>
          <label>
            Проект <span aria-hidden="true">*</span>
            <select
              aria-describedby={errors.projectId ? `${formId}-projectId-error` : undefined}
              aria-invalid={Boolean(errors.projectId)}
              defaultValue={props.projectId ?? props.task?.projectId ?? ""}
              disabled={Boolean(props.projectId || props.task)}
              name="projectId"
            >
              <option value="">Выберите проект</option>
              {props.data.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <FieldError errors={errors} field="projectId" formId={formId} />
          </label>
          <label>
            Описание задачи
            <textarea
              defaultValue={props.task?.description ?? ""}
              maxLength={2000}
              name="description"
              placeholder="Что нужно сделать, критерии готовности, ссылки на контекст"
            />
          </label>
        </section>

        <section className="task-form-section">
          <h3>2. Участники</h3>
          <div className="form-grid">
            <UserSelect
              defaultValue={initialRequesterId}
              error={errors.requesterId}
              formId={formId}
              label="Постановщик"
              name="requesterId"
              users={activeUsers}
            />
            <UserSelect
              defaultValue={initialExecutorId}
              error={errors.executorId}
              formId={formId}
              label="Ответственный"
              name="executorId"
              users={activeUsers}
            />
          </div>
          <div className="form-grid">
            <MultiUserCheckboxes
              defaultValues={initialCoExecutors}
              label="Соисполнители"
              name="coExecutorIds"
              users={activeUsers}
            />
            <MultiUserCheckboxes
              defaultValues={initialObservers}
              label="Наблюдатели"
              name="observerIds"
              users={activeUsers}
            />
          </div>
        </section>

        <section className="task-form-section">
          <h3>3. План</h3>
          <div className="task-form-plan-grid">
            <span className="form-field-shell">
              <DatePickerField
                describedBy={errors.plannedStart ? `${formId}-plannedStart-error` : undefined}
                disabled={props.isPending}
                id={`${formId}-plannedStart`}
                invalid={Boolean(errors.plannedStart)}
                label="Начало"
                value={plannedStart}
                onChange={setPlannedStart}
              />
              <FieldError errors={errors} field="plannedStart" formId={formId} />
            </span>
            <span className="form-field-shell">
              <DatePickerField
                describedBy={errors.plannedFinish ? `${formId}-plannedFinish-error` : undefined}
                disabled={props.isPending}
                id={`${formId}-plannedFinish`}
                invalid={Boolean(errors.plannedFinish)}
                label="Окончание"
                value={plannedFinish}
                onChange={setPlannedFinish}
              />
              <FieldError errors={errors} field="plannedFinish" formId={formId} />
            </span>
            <label>
              Длительность
              <input
                aria-describedby={errors.durationWorkingDays ? `${formId}-durationWorkingDays-error` : undefined}
                aria-invalid={Boolean(errors.durationWorkingDays)}
                defaultValue={props.task?.durationWorkingDays ?? 1}
                min={1}
                name="durationWorkingDays"
                type="number"
              />
              <small>раб. дн.</small>
              <FieldError errors={errors} field="durationWorkingDays" formId={formId} />
            </label>
            <label>
              Трудозатраты
              <input
                aria-describedby={errors.plannedWork ? `${formId}-plannedWork-error` : undefined}
                aria-invalid={Boolean(errors.plannedWork)}
                defaultValue={props.task?.plannedWork ?? 8}
                min={1}
                name="plannedWork"
                type="number"
              />
              <small>ч</small>
              <FieldError errors={errors} field="plannedWork" formId={formId} />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              defaultChecked={props.task?.requiresAcceptance ?? true}
              name="requiresAcceptance"
              type="checkbox"
            />
            Обязательная проверка результата постановщиком перед закрытием
          </label>
        </section>

        <section className="task-form-section muted-section">
          <h3>4. Материалы и связи</h3>
          <div className="task-form-disabled-zone">
            Вложения будут добавлены через storage/connector слой. Связи-предшественники задаются в Gantt,
            чтобы не ломать планирование.
          </div>
        </section>

        {submitError ? <p className="error">{submitError}</p> : null}
        <footer className="task-form-actions">
          <span>Права и изменения будут проверены API и записаны в аудит.</span>
          <div>
            <button
              className="secondary-button"
              disabled={props.isPending}
              type="button"
              onClick={props.onClose}
            >
              Отмена
            </button>
            <button className="primary-button" disabled={props.isPending} type="submit">
              {props.isPending
                ? "Сохраняем..."
                : props.task
                  ? "Сохранить задачу"
                  : "Создать задачу"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}

function UserSelect(props: {
  defaultValue: string;
  error?: string | undefined;
  formId: string;
  label: string;
  name: string;
  users: WorkspaceData["users"];
}) {
  return (
    <label>
      {props.label} <span aria-hidden="true">*</span>
      <select
        aria-describedby={props.error ? `${props.formId}-${props.name}-error` : undefined}
        aria-invalid={Boolean(props.error)}
        defaultValue={props.defaultValue}
        name={props.name}
      >
        <option value="">Выберите пользователя</option>
        {props.users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      <FieldError errors={{ [props.name]: props.error ?? "" }} field={props.name} formId={props.formId} />
    </label>
  );
}

function MultiUserCheckboxes(props: {
  defaultValues: Set<string>;
  label: string;
  name: string;
  users: WorkspaceData["users"];
}) {
  return (
    <fieldset className="task-user-checkboxes">
      <legend>{props.label}</legend>
      {props.users.map((user) => (
        <label className="checkbox-row compact" key={user.id}>
          <input
            defaultChecked={props.defaultValues.has(user.id)}
            name={props.name}
            type="checkbox"
            value={user.id}
          />
          {user.name}
        </label>
      ))}
    </fieldset>
  );
}

function buildParticipants(input: {
  requesterId: string;
  executorId: string;
  coExecutorIds: string[];
  observerIds: string[];
}): TaskParticipant[] {
  const participants: TaskParticipant[] = [];
  const pushUnique = (userId: string, role: TaskParticipant["role"]) => {
    if (!userId) return;
    if (participants.some((participant) => participant.userId === userId && participant.role === role)) return;
    participants.push({ userId, role });
  };

  pushUnique(input.requesterId, "requester");
  pushUnique(input.executorId, "executor");
  input.coExecutorIds.forEach((userId) => pushUnique(userId, "co_executor"));
  input.observerIds.forEach((userId) => pushUnique(userId, "observer"));
  return participants;
}

function validateTaskForm(
  input: TaskInput | TaskUpdateInput,
  projectId: string
): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (!projectId) errors.projectId = "Выберите проект.";
  if (!input.statusId) errors.statusId = "Выберите статус.";
  if (input.title.length < 3) errors.title = "Укажите название задачи.";
  const requester = input.participants.find((participant) => participant.role === "requester");
  const executor = input.participants.find((participant) => participant.role === "executor");
  if (!requester?.userId) errors.requesterId = "Выберите постановщика.";
  if (!executor?.userId) errors.executorId = "Выберите ответственного.";
  if (!input.plannedStart) errors.plannedStart = "Укажите дату начала.";
  if (!input.plannedFinish) errors.plannedFinish = "Укажите дату окончания.";
  if (input.plannedStart && input.plannedFinish && input.plannedFinish < input.plannedStart) {
    errors.plannedFinish = "Окончание не может быть раньше начала.";
  }
  if (!Number.isInteger(input.durationWorkingDays) || input.durationWorkingDays < 1) {
    errors.durationWorkingDays = "Укажите длительность в рабочих днях.";
  }
  if (!Number.isInteger(input.plannedWork) || input.plannedWork < 1) {
    errors.plannedWork = "Укажите трудозатраты в часах.";
  }
  return errors;
}

export function getDefaultTaskPriorityOptions() {
  return (["low", "normal", "high", "critical"] as const).map((priority) => ({
    value: priority,
    label: getPriorityLabel(priority)
  }));
}

export function getDefaultTaskRoleOptions() {
  return (["requester", "executor", "co_executor", "observer"] as const).map((role) => ({
    value: role,
    label: getRoleLabel(role)
  }));
}
