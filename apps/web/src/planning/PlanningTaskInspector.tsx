import type {
  PlanningGanttIntent,
  PlanningGanttTaskRow,
  PlanningGanttTaskType
} from "@kiss-pm/planning-gantt-ui";
import { useEffect, useMemo, useState } from "react";

import type { TaskStatusDefinition } from "../api";
import "./planningWorkspace.css";

export type TaskInspectorIntentKind = "identity" | "schedule" | "work" | "status";

export type TaskInspectorDraft = {
  title: string;
  plannedStart: string;
  plannedFinish: string;
  durationHours: string;
  workHours: string;
  taskType: PlanningGanttTaskType;
  effortDriven: boolean;
  statusId: string;
};

export function PlanningTaskInspector(props: {
  task: PlanningGanttTaskRow | null;
  taskStatuses: readonly TaskStatusDefinition[];
  canManagePlan: boolean;
  isPreviewPending: boolean;
  onIntent: (intent: PlanningGanttIntent) => void;
}) {
  const [draft, setDraft] = useState<TaskInspectorDraft | null>(
    props.task ? createTaskInspectorDraft(props.task) : null
  );

  useEffect(() => {
    setDraft(props.task ? createTaskInspectorDraft(props.task) : null);
  }, [props.task?.id]);

  const activeStatuses = useMemo(
    () => props.taskStatuses.filter((status) => status.status === "active"),
    [props.taskStatuses]
  );

  if (!props.task || !draft) {
    return (
      <section className="planning-side-panel planning-task-inspector">
        <h3>Инспектор задачи</h3>
        <p className="muted">Выберите строку WBS, чтобы увидеть поля задачи и preview-действия.</p>
      </section>
    );
  }

  const identityIntent = buildTaskInspectorIntent("identity", draft, props.task);
  const scheduleIntent = buildTaskInspectorIntent("schedule", draft, props.task);
  const workIntent = buildTaskInspectorIntent("work", draft, props.task);
  const statusIntent = buildTaskInspectorIntent("status", draft, props.task);
  const disabledReason = props.canManagePlan
    ? "Нет изменений для preview"
    : "Нужно право tenant.project_plan.manage";

  function emitIntent(kind: TaskInspectorIntentKind) {
    if (!draft || !props.task) return;
    const intent = buildTaskInspectorIntent(kind, draft, props.task);
    if (intent) props.onIntent(intent);
  }

  return (
    <section className="planning-side-panel planning-task-inspector">
      <div>
        <h3>Инспектор задачи</h3>
        <p className="muted">
          WBS {props.task.wbsCode}, {props.task.schedulingMode}, {props.task.taskType}
        </p>
      </div>
      <label>
        <span>Название</span>
        <input
          disabled={!props.canManagePlan}
          type="text"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
        />
      </label>
      <button
        className="secondary-button compact"
        disabled={!props.canManagePlan || !identityIntent || props.isPreviewPending}
        title={identityIntent && props.canManagePlan ? "Preview переименования через planning engine" : disabledReason}
        type="button"
        onClick={() => emitIntent("identity")}
      >
        Preview названия
      </button>
      <div className="planning-field-grid">
        <label>
          <span>Старт</span>
          <input
            disabled={!props.canManagePlan}
            type="date"
            value={draft.plannedStart}
            onChange={(event) => setDraft({ ...draft, plannedStart: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Финиш</span>
          <input
            disabled={!props.canManagePlan}
            type="date"
            value={draft.plannedFinish}
            onChange={(event) => setDraft({ ...draft, plannedFinish: event.currentTarget.value })}
          />
        </label>
      </div>
      <button
        className="secondary-button compact"
        disabled={!props.canManagePlan || !scheduleIntent || props.isPreviewPending}
        title={scheduleIntent && props.canManagePlan ? "Preview дат через planning engine" : disabledReason}
        type="button"
        onClick={() => emitIntent("schedule")}
      >
        Preview дат
      </button>
      <div className="planning-field-grid">
        <label>
          <span>Длительность, ч</span>
          <input
            disabled={!props.canManagePlan}
            inputMode="decimal"
            min="0"
            type="number"
            value={draft.durationHours}
            onChange={(event) => setDraft({ ...draft, durationHours: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Работа, ч</span>
          <input
            disabled={!props.canManagePlan}
            inputMode="decimal"
            min="0"
            type="number"
            value={draft.workHours}
            onChange={(event) => setDraft({ ...draft, workHours: event.currentTarget.value })}
          />
        </label>
      </div>
      <div className="planning-field-grid">
        <label>
          <span>Task type</span>
          <select
            disabled={!props.canManagePlan}
            value={draft.taskType}
            onChange={(event) => setDraft({
              ...draft,
              taskType: event.currentTarget.value as PlanningGanttTaskType
            })}
          >
            <option value="fixed_units">Fixed units</option>
            <option value="fixed_work">Fixed work</option>
            <option value="fixed_duration">Fixed duration</option>
          </select>
        </label>
        <label className="planning-checkbox-row">
          <input
            checked={draft.effortDriven}
            disabled={!props.canManagePlan}
            type="checkbox"
            onChange={(event) => setDraft({ ...draft, effortDriven: event.currentTarget.checked })}
          />
          <span>Effort-driven</span>
        </label>
      </div>
      <button
        className="secondary-button compact"
        disabled={!props.canManagePlan || !workIntent || props.isPreviewPending}
        title={workIntent && props.canManagePlan ? "Preview work model через planning engine" : disabledReason}
        type="button"
        onClick={() => emitIntent("work")}
      >
        Preview work model
      </button>
      <label>
        <span>Статус</span>
        <select
          disabled={!props.canManagePlan}
          value={draft.statusId}
          onChange={(event) => setDraft({ ...draft, statusId: event.currentTarget.value })}
        >
          {activeStatuses.map((status) => (
            <option key={status.id} value={status.id}>{status.name}</option>
          ))}
        </select>
      </label>
      <button
        className="secondary-button compact"
        disabled={!props.canManagePlan || !statusIntent || props.isPreviewPending}
        title={statusIntent && props.canManagePlan ? "Preview статуса через planning engine" : disabledReason}
        type="button"
        onClick={() => emitIntent("status")}
      >
        Preview статуса
      </button>
    </section>
  );
}

export function createTaskInspectorDraft(task: PlanningGanttTaskRow): TaskInspectorDraft {
  return {
    title: task.title,
    plannedStart: task.plannedStart ?? "",
    plannedFinish: task.plannedFinish ?? "",
    durationHours: minutesToHoursInput(task.durationMinutes),
    workHours: minutesToHoursInput(task.workMinutes),
    taskType: task.taskType,
    effortDriven: task.effortDriven,
    statusId: task.statusId
  };
}

export function buildTaskInspectorIntent(
  kind: TaskInspectorIntentKind,
  draft: TaskInspectorDraft,
  original: PlanningGanttTaskRow
): PlanningGanttIntent | null {
  if (kind === "identity") {
    const title = draft.title.trim();
    if (!title || title === original.title) return null;
    return { type: "task.rename", taskId: original.id, title };
  }

  if (kind === "schedule") {
    const plannedStart = nullableDate(draft.plannedStart);
    const plannedFinish = nullableDate(draft.plannedFinish);
    if (plannedStart === original.plannedStart && plannedFinish === original.plannedFinish) return null;
    return { type: "task.schedule.drag", taskId: original.id, plannedStart, plannedFinish };
  }

  if (kind === "work") {
    const durationMinutes = hoursInputToMinutesOrNull(draft.durationHours);
    const workMinutes = hoursInputToMinutes(draft.workHours);
    if (
      durationMinutes === original.durationMinutes &&
      workMinutes === original.workMinutes &&
      draft.taskType === original.taskType &&
      draft.effortDriven === original.effortDriven
    ) {
      return null;
    }
    return {
      type: "task.work_model.edit",
      taskId: original.id,
      durationMinutes,
      workMinutes,
      taskType: draft.taskType,
      effortDriven: draft.effortDriven
    };
  }

  if (draft.statusId === original.statusId) return null;
  return { type: "task.status.update", taskId: original.id, statusId: draft.statusId };
}

function nullableDate(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function minutesToHoursInput(minutes: number | null): string {
  if (minutes === null) return "";
  return String(Math.round((minutes / 60) * 100) / 100);
}

function hoursInputToMinutes(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 60);
}

function hoursInputToMinutesOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  return hoursInputToMinutes(value);
}
