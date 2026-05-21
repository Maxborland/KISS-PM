"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Task, TaskInput, TaskParticipant, TaskStatusDefinition, TaskUpdateInput } from "./api";
import { DatePickerField } from "./components/DatePickerField";
import { FieldError, Modal } from "./components/workspace-ui";
import {
  getPriorityLabel,
  getRoleLabel,
  sortTaskStatuses
} from "./taskWorkspace";
import { normalizeTaskFormDate } from "./taskFormDates";
import type { WorkspaceData } from "./workspaceData";

type TaskFormErrors = Record<string, string>;

export function TaskFormDialog(props: {
  data: WorkspaceData;
  initialStatusId?: string | undefined;
  task?: Task | undefined;
  projectId?: string | undefined;
  taskStatuses: readonly TaskStatusDefinition[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (
    input: TaskInput | TaskUpdateInput,
    projectId: string,
    intent?: "save" | "open"
  ) => Promise<void>;
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
    props.initialStatusId ??
    activeStatuses.find((status) => status.category === "new")?.id ??
    activeStatuses[0]?.id ??
    "";
  const [plannedStart, setPlannedStart] = useState(normalizeTaskFormDate(props.task?.plannedStart));
  const [plannedFinish, setPlannedFinish] = useState(normalizeTaskFormDate(props.task?.plannedFinish));
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
    setPlannedStart(normalizeTaskFormDate(props.task?.plannedStart));
    setPlannedFinish(normalizeTaskFormDate(props.task?.plannedFinish));
  }, [props.task?.id]);

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value === "open" ? "open" : "save";
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
      id: undefined,
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
      await props.onSubmit(input, projectId, intent);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось сохранить задачу.");
    }
  }

  return (
    <Modal
      title={props.task ? "Редактировать задачу" : "Создать задачу"}
      description="Заполните рабочие поля задачи. Предшественники задаются в Gantt."
      isDismissDisabled={props.isPending}
      size="wide"
      onClose={props.onClose}
    >
      <form className="task-form-grid" noValidate onSubmit={submitTask}>
        <section className="task-form-section">
          <h3>1. Основное</h3>
          <div className="form-grid">
            <label>
              <span className="field-label">Название <b aria-hidden="true">*</b></span>
              <input
                aria-describedby={errors.title ? `${formId}-title-error` : undefined}
                aria-invalid={Boolean(errors.title)}
                defaultValue={props.task?.title ?? ""}
                name="title"
                placeholder="Например, подготовить ресурсную оценку"
              />
              <FieldError errors={errors} field="title" formId={formId} />
            </label>
            <label>
              <span className="field-label">Статус <b aria-hidden="true">*</b></span>
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
            <span className="field-label">Проект <b aria-hidden="true">*</b></span>
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
            <span className="field-label">Описание задачи</span>
            <textarea
              defaultValue={props.task?.description ?? ""}
              maxLength={2000}
              name="description"
              placeholder="Что нужно сделать, критерии готовности, ссылки на контекст"
            />
            <small className="task-form-counter">0 / 2000</small>
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
            <MultiUserSelect
              defaultValues={initialCoExecutors}
              label="Соисполнители"
              name="coExecutorIds"
              users={activeUsers}
            />
            <MultiUserSelect
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
              <span className="field-label">Длительность <b aria-hidden="true">*</b></span>
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
              <span className="field-label">Трудозатраты <b aria-hidden="true">*</b></span>
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
          <label className="task-check-row">
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
          <div>
            <button
              className="secondary-button"
              disabled={props.isPending}
              type="button"
              onClick={props.onClose}
            >
              Отмена
            </button>
            {!props.task ? (
              <button
                className="secondary-button"
                disabled={props.isPending}
                name="intent"
                type="submit"
                value="open"
              >
                Создать и открыть
              </button>
            ) : null}
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
      <span className="field-label">{props.label} <b aria-hidden="true">*</b></span>
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

function MultiUserSelect(props: {
  defaultValues: Set<string>;
  label: string;
  name: string;
  users: WorkspaceData["users"];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => Array.from(props.defaultValues));
  const defaultKey = Array.from(props.defaultValues).sort().join("|");
  const selectedUsers = props.users.filter((user) => selectedIds.includes(user.id));

  useEffect(() => {
    setSelectedIds(Array.from(props.defaultValues));
    setIsOpen(false);
  }, [defaultKey]);

  function toggleUser(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((selectedId) => selectedId !== userId)
        : [...current, userId]
    );
  }

  return (
    <fieldset className="task-multi-select">
      <legend>{props.label}</legend>
      {selectedIds.map((userId) => (
        <input key={userId} name={props.name} type="hidden" value={userId} />
      ))}
      <button
        aria-expanded={isOpen}
        className="task-multi-trigger"
        type="button"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className={selectedUsers.length > 0 ? "task-multi-values" : "task-multi-placeholder"}>
          {selectedUsers.length > 0
            ? selectedUsers.map((user) => (
                <span className="task-multi-chip" key={user.id}>{user.name}</span>
              ))
            : "Выберите пользователей"}
        </span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {isOpen ? (
        <div className="task-multi-menu">
          {props.users.map((user) => {
            const isSelected = selectedIds.includes(user.id);
            return (
              <button
                aria-pressed={isSelected}
                className={isSelected ? "selected" : ""}
                key={user.id}
                type="button"
                onClick={() => toggleUser(user.id)}
              >
                <span className="task-multi-check">{isSelected ? "✓" : ""}</span>
                <span>{user.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
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
