"use client";

import { useMemo, type ReactElement } from "react";

import { UrlPeekSheet } from "@/workspace/lib/url-peek";
import type { TaskPriority, TaskRecord, TaskStatusCategory } from "@/workspace/lib/workspace-client";

export type TaskPeekFact = {
  label: string;
  value: string;
};

export type TaskPeekRecord = {
  id: string;
  title: string;
  status?: { label: string; category?: TaskStatusCategory };
  progress?: number;
  project?: { id: string; name?: string };
  plannedStart?: string;
  plannedFinish?: string;
  durationWorkingDays?: number;
  plannedWork?: number;
  actualWork?: number;
  description?: string;
  facts?: readonly TaskPeekFact[];
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  critical: "Критичный"
};

const TASK_DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC"
});

function formatTaskDate(value: string) {
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!datePart) return value;
  return TASK_DATE_FORMAT.format(
    new Date(Date.UTC(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3])))
  );
}

/** Converts the workspace wire record without filling in unavailable project or task data. */
export function taskPeekRecordFromWorkspace(task: TaskRecord): TaskPeekRecord {
  const facts: TaskPeekFact[] = [{ label: "Приоритет", value: PRIORITY_LABEL[task.priority] }];
  if (task.requiresAcceptance) facts.push({ label: "Приёмка", value: "Требуется" });

  return {
    id: task.id,
    title: task.title,
    status: { label: task.statusName, category: task.statusCategory },
    progress: task.progress,
    project: { id: task.projectId },
    plannedStart: task.plannedStart,
    plannedFinish: task.plannedFinish,
    durationWorkingDays: task.durationWorkingDays,
    plannedWork: task.plannedWork,
    actualWork: task.actualWork,
    ...(task.description?.trim() ? { description: task.description } : {}),
    ...(facts.length > 0 ? { facts } : {})
  };
}

type TaskPeekProps = {
  task: TaskPeekRecord;
  /** One focusable element rendered as Radix SheetTrigger via asChild. */
  children: ReactElement;
};

/**
 * URL-controlled Sheet (`?task=<id>`) поверх общего примитива UrlPeekSheet
 * (App Router внутри Next, window.history-fallback в Storybook — см. url-peek.tsx).
 */
export function TaskPeek({ task, children }: TaskPeekProps): ReactElement {
  const summary = useMemo(() => {
    const parts = [task.status?.label, typeof task.progress === "number" ? `${task.progress}%` : undefined].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "Детали задачи";
  }, [task.progress, task.status?.label]);

  return (
    <UrlPeekSheet
      param="task"
      id={task.id}
      title={task.title}
      description={summary}
      fullHref={`/tasks/${encodeURIComponent(task.id)}`}
      trigger={children}
    >
      <TaskPeekDetails task={task} />
    </UrlPeekSheet>
  );
}

/** Shared read-only detail fields used by the Sheet and canonical task page. */
export function TaskPeekDetails({ task }: { task: TaskPeekRecord }) {
  const details = [
    task.status ? { label: "Статус", value: task.status.label } : null,
    typeof task.progress === "number" ? { label: "Прогресс", value: `${task.progress}%` } : null,
    task.project?.name ? { label: "Проект", value: task.project.name } : null,
    task.plannedStart ? { label: "Начало", value: formatTaskDate(task.plannedStart) } : null,
    task.plannedFinish ? { label: "Окончание", value: formatTaskDate(task.plannedFinish) } : null,
    typeof task.durationWorkingDays === "number" ? { label: "Длительность", value: `${task.durationWorkingDays} раб. дн.` } : null,
    typeof task.plannedWork === "number" ? { label: "Плановые трудозатраты", value: `${task.plannedWork} ч` } : null,
    typeof task.actualWork === "number" ? { label: "Фактические трудозатраты", value: `${task.actualWork} ч` } : null
  ].filter((detail): detail is TaskPeekFact => detail !== null);

  return (
    <div className="flex flex-col gap-5">
      {details.length > 0 ? (
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="min-w-0">
              <dt className="text-[length:var(--text-xs)] font-medium text-[var(--muted)]">{detail.label}</dt>
              <dd className="mt-0.5 break-words text-[length:var(--text-sm)] text-[var(--text)]">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {task.description ? (
        <section aria-labelledby="task-peek-description">
          <h2 id="task-peek-description" className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Описание</h2>
          <p className="mt-2 whitespace-pre-wrap text-[length:var(--text-sm)] leading-[var(--lh-md)] text-[var(--text)]">{task.description}</p>
        </section>
      ) : null}

      {task.facts && task.facts.length > 0 ? (
        <section aria-labelledby="task-peek-facts">
          <h2 id="task-peek-facts" className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Факты</h2>
          <dl className="mt-2 grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {task.facts.map((fact, index) => (
              <div key={`${fact.label}-${index}`} className="min-w-0">
                <dt className="text-[length:var(--text-xs)] font-medium text-[var(--muted)]">{fact.label}</dt>
                <dd className="mt-0.5 break-words text-[length:var(--text-sm)] text-[var(--text)]">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
