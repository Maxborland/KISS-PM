import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Task, TaskInput, TaskStatus } from "./api";
import { DatePickerField } from "./components/DatePickerField";
import type { WorkspaceData } from "./workspaceData";
import { formatDateOnly } from "./workspaceViewHelpers";
import type { SectionState } from "./workspaceShellState";
import { hasPermission } from "./workspaceShellState";
import {
  FieldError,
  Modal,
  Panel,
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";
import {
  canUserTransitionTask,
  formatTaskStatus,
  getNextTaskAction
} from "./taskStatusView";
import {
  useProjectDetailQuery,
  useProjectWorkMutations
} from "./workspaceQueries";

type TaskFormErrors = Record<string, string>;

export function ProjectDetailView(props: {
  data: WorkspaceData;
  projectId: string;
  onBack: () => void;
  onChanged: (message: string) => void;
  sectionState: SectionState;
}) {
  const canManageProjects = hasPermission(props.data.permissions, "tenant.projects.manage");
  const projectDetailQuery = useProjectDetailQuery(
    props.projectId,
    props.sectionState.canRead
  );
  const projectWorkMutations = useProjectWorkMutations();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [transitionError, setTransitionError] = useState("");
  const project = projectDetailQuery.data?.project ??
    props.data.projects.find((candidate) => candidate.id === props.projectId);
  const tasks = projectDetailQuery.data?.tasks ?? [];
  const participantOptions = useMemo(
    () =>
      props.data.users.length > 0
        ? props.data.users.filter((user) => user.status !== "inactive")
        : [props.data.me],
    [props.data.me, props.data.users]
  );
  const plannedTaskWork = tasks.reduce((sum, task) => sum + task.plannedWork, 0);
  const pendingTaskId = projectWorkMutations.updateTaskStatus.variables
    ? String(projectWorkMutations.updateTaskStatus.variables.taskId)
    : null;

  async function transitionTask(task: Task, status: TaskStatus) {
    setTransitionError("");
    try {
      await projectWorkMutations.updateTaskStatus.mutateAsync({
        projectId: task.projectId,
        taskId: task.id,
        input: { status }
      });
      props.onChanged("Статус задачи обновлен и записан в аудит.");
    } catch (error) {
      setTransitionError(
        error instanceof Error ? error.message : "Не удалось обновить статус задачи."
      );
    }
  }

  if (!props.sectionState.canRead) {
    return (
      <Panel title="Проект" subtitle="Доступ к проектному контуру ограничен.">
        <SectionFeedback state={props.sectionState} emptyLabel="Проект недоступен." />
      </Panel>
    );
  }

  return (
    <Panel
      title={project?.title ?? "Проект"}
      subtitle="Детали активного проекта, стартовая таблица задач и единая точка создания Task."
      actions={
        <div className="panel-actions">
          <button className="secondary-button" type="button" onClick={props.onBack}>
            <ArrowLeft aria-hidden="true" size={16} />
            К проектам
          </button>
          {canManageProjects ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus aria-hidden="true" size={16} />
              Создать задачу
            </button>
          ) : (
            <button
              className="secondary-button"
              disabled
              title="Нужно право tenant.projects.manage"
              type="button"
            >
              Создать задачу
            </button>
          )}
        </div>
      }
    >
      <SectionFeedback
        state={{
          ...props.sectionState,
          isLoading: projectDetailQuery.isFetching,
          error: projectDetailQuery.error
            ? "Не удалось загрузить проект."
            : props.sectionState.error
        }}
        emptyLabel="Проект недоступен."
      />
      {project ? (
        <>
          <div className="surface-summary-grid">
            <SummaryCard label="Плановые часы проекта" value={project.plannedHours} />
            <SummaryCard label="Часы задач" value={plannedTaskWork} tone="success" />
            <SummaryCard label="Задачи" value={tasks.length} tone="muted" />
          </div>
          <div className="detail-grid">
            <section className="detail-card">
              <span className="detail-label">Клиент</span>
              <strong>{project.clientName}</strong>
            </section>
            <section className="detail-card">
              <span className="detail-label">Период</span>
              <strong>
                {formatDateOnly(project.plannedStart)}
                {" -> "}
                {formatDateOnly(project.plannedFinish)}
              </strong>
            </section>
            <section className="detail-card">
              <span className="detail-label">Статус</span>
              <StatusPill label="Активен" tone="success" />
            </section>
          </div>
          <div className="table-wrap">
            {transitionError ? <p className="error">{transitionError}</p> : null}
            <table className="data-table" aria-label="Задачи проекта">
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>Период</th>
                  <th>План</th>
                  <th>Участники</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <TableEmpty colSpan={6} label="В проекте пока нет задач." />
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.title}</strong>
                        {task.description ? (
                          <small className="muted">{task.description}</small>
                        ) : null}
                      </td>
                      <td>
                        <span className="toolbar-chip">
                          <CalendarDays aria-hidden="true" size={14} />
                          {formatDateOnly(task.plannedStart)}
                          {" -> "}
                          {formatDateOnly(task.plannedFinish)}
                        </span>
                      </td>
                      <td>{task.plannedWork} ч</td>
                      <td>
                        <span className="chip-list">
                          {task.participants.map((participant) => (
                            <span
                              className="permission-chip"
                              key={`${participant.userId}:${participant.role}`}
                            >
                              {getUserName(participant.userId, props.data)}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        <StatusPill
                          label={formatTaskStatus(task.status)}
                          tone={task.status === "done" ? "muted" : "success"}
                        />
                      </td>
                      <td>
                        <span className="table-actions">
                          {getNextTaskAction(task.status) ? (
                            <button
                              className="primary-button compact"
                              disabled={
                                (!canManageProjects &&
                                  !canUserTransitionTask(task, props.data.me.id)) ||
                                (projectWorkMutations.updateTaskStatus.isPending &&
                                  pendingTaskId === task.id)
                              }
                              title={
                                canManageProjects ||
                                canUserTransitionTask(task, props.data.me.id)
                                  ? undefined
                                  : "Нужно право tenant.projects.manage или роль executor/co_executor/controller в задаче"
                              }
                              type="button"
                              onClick={() => {
                                const action = getNextTaskAction(task.status);
                                if (action) void transitionTask(task, action.status);
                              }}
                            >
                              {projectWorkMutations.updateTaskStatus.isPending &&
                              pendingTaskId === task.id
                                ? "Сохраняем..."
                                : getNextTaskAction(task.status)?.label}
                            </button>
                          ) : (
                            <button
                              className="secondary-button compact"
                              disabled
                              title="Задача уже завершена."
                              type="button"
                            >
                              Готово
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : projectDetailQuery.isFetching ? null : (
        <p className="empty-state">Проект не найден или уже не активен.</p>
      )}
      {isCreateOpen && project ? (
        <CreateTaskModal
          isPending={projectWorkMutations.createTask.isPending}
          participantOptions={participantOptions}
          projectId={project.id}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (input) => {
            await projectWorkMutations.createTask.mutateAsync({
              projectId: project.id,
              input
            });
            setIsCreateOpen(false);
            props.onChanged("Задача создана и записана в аудит.");
          }}
        />
      ) : null}
    </Panel>
  );
}

function CreateTaskModal(props: {
  isPending: boolean;
  participantOptions: WorkspaceData["users"];
  projectId: string;
  onClose: () => void;
  onSubmit: (input: TaskInput) => Promise<void>;
}) {
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedFinish, setPlannedFinish] = useState("");
  const [submitError, setSubmitError] = useState("");
  const formId = "project-task-create";

  useEffect(() => {
    setErrors({});
    setPlannedStart("");
    setPlannedFinish("");
    setSubmitError("");
  }, [props.projectId]);

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: TaskInput = {
      id: String(form.get("id") ?? "").trim() || undefined,
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      priority: String(form.get("priority") ?? "normal") as TaskInput["priority"],
      plannedStart,
      plannedFinish,
      plannedWork: Number(form.get("plannedWork") ?? 0),
      participants: [
        {
          userId: String(form.get("executorId") ?? ""),
          role: "executor"
        }
      ]
    };
    const validationErrors = validateTaskForm(input);
    setErrors(validationErrors);
    setSubmitError("");
    if (Object.keys(validationErrors).length > 0) return;

    try {
      await props.onSubmit(input);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось создать задачу.");
    }
  }

  return (
    <Modal
      title="Создать задачу"
      description="Task создается в активном проекте и сразу попадает в My Work назначенного исполнителя."
      isDismissDisabled={props.isPending}
      onClose={props.onClose}
    >
      <form className="stack-form modal-form" noValidate onSubmit={submitTask}>
        <label>
          Код задачи
          <input name="id" placeholder="task-project-plan" />
        </label>
        <label>
          Название
          <input
            aria-describedby={errors.title ? `${formId}-title-error` : undefined}
            aria-invalid={Boolean(errors.title)}
            data-autofocus
            name="title"
            placeholder="Подготовить план внедрения"
          />
          <FieldError errors={errors} field="title" formId={formId} />
        </label>
        <label>
          Описание
          <textarea name="description" placeholder="Короткий рабочий контекст" />
        </label>
        <div className="form-grid">
          <label>
            Приоритет
            <select name="priority" defaultValue="normal">
              <option value="low">Низкий</option>
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
              <option value="critical">Критичный</option>
            </select>
          </label>
          <label>
            Исполнитель
            <select
              aria-describedby={errors.executorId ? `${formId}-executorId-error` : undefined}
              aria-invalid={Boolean(errors.executorId)}
              name="executorId"
              defaultValue={props.participantOptions[0]?.id ?? ""}
            >
              {props.participantOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <FieldError errors={errors} field="executorId" formId={formId} />
          </label>
        </div>
        <div className="form-grid">
          <span className="form-field-shell">
            <DatePickerField
              describedBy={errors.plannedStart ? `${formId}-plannedStart-error` : undefined}
              disabled={props.isPending}
              id={`${formId}-plannedStart`}
              invalid={Boolean(errors.plannedStart)}
              label="Старт"
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
              label="Финиш"
              value={plannedFinish}
              onChange={setPlannedFinish}
            />
            <FieldError errors={errors} field="plannedFinish" formId={formId} />
          </span>
        </div>
        <label>
          Плановые часы
          <input
            aria-describedby={errors.plannedWork ? `${formId}-plannedWork-error` : undefined}
            aria-invalid={Boolean(errors.plannedWork)}
            min={1}
            name="plannedWork"
            type="number"
          />
          <FieldError errors={errors} field="plannedWork" formId={formId} />
        </label>
        {submitError ? <p className="error">{submitError}</p> : null}
        <div className="form-actions">
          <button
            className="primary-button"
            disabled={props.isPending}
            type="submit"
          >
            {props.isPending ? "Создаем..." : "Создать задачу"}
          </button>
          <button
            className="secondary-button"
            disabled={props.isPending}
            type="button"
            onClick={props.onClose}
          >
            Отменить
          </button>
        </div>
      </form>
    </Modal>
  );
}

function validateTaskForm(input: TaskInput): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (input.title.length < 3) {
    errors.title = "Укажите название задачи.";
  }
  if (!input.participants[0]?.userId) {
    errors.executorId = "Выберите исполнителя.";
  }
  if (!input.plannedStart) {
    errors.plannedStart = "Укажите дату старта.";
  }
  if (!input.plannedFinish) {
    errors.plannedFinish = "Укажите дату финиша.";
  }
  if (
    input.plannedStart &&
    input.plannedFinish &&
    input.plannedFinish < input.plannedStart
  ) {
    errors.plannedFinish = "Финиш не может быть раньше старта.";
  }
  if (!Number.isInteger(input.plannedWork) || input.plannedWork < 1) {
    errors.plannedWork = "Укажите плановые часы целым числом.";
  }
  return errors;
}

function getUserName(userId: string, data: WorkspaceData): string {
  if (data.me.id === userId) return data.me.name;
  return data.users.find((user) => user.id === userId)?.name ?? userId;
}
