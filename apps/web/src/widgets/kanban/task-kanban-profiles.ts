import type { PriorityLevel } from "@/components/domain/priority-flag";

import type { KanbanComparators } from "@/widgets/kanban/kanban-column-sort";
import type {
  KanbanCardViewProfile,
  KanbanCardViewState,
  KanbanSortOption
} from "@/widgets/kanban/types";
import type { TaskKanbanItem } from "@/widgets/kanban/task-kanban-card";

export const TASK_KANBAN_FIELD = {
  meta: "meta",
  assignees: "assignees",
  comments: "comments",
  date: "date",
  priority: "priority",
  progress: "progress",
  work: "work",
  acceptance: "acceptance"
} as const;

export type TaskKanbanFieldId = (typeof TASK_KANBAN_FIELD)[keyof typeof TASK_KANBAN_FIELD];

export const TASK_KANBAN_VIEW_PROFILE: KanbanCardViewProfile = {
  id: "task",
  label: "Задачи",
  fields: [
    { id: TASK_KANBAN_FIELD.priority, label: "Приоритет", defaultOn: true },
    { id: TASK_KANBAN_FIELD.meta, label: "Метки и проект", defaultOn: true },
    { id: TASK_KANBAN_FIELD.assignees, label: "Исполнители", defaultOn: true },
    { id: TASK_KANBAN_FIELD.comments, label: "Комментарии", defaultOn: true },
    { id: TASK_KANBAN_FIELD.date, label: "Срок", defaultOn: true },
    { id: TASK_KANBAN_FIELD.progress, label: "Прогресс", defaultOn: true },
    { id: TASK_KANBAN_FIELD.work, label: "План/факт", defaultOn: false },
    { id: TASK_KANBAN_FIELD.acceptance, label: "Приемка", defaultOn: true }
  ]
};

export const TASK_KANBAN_SORT_OPTIONS: KanbanSortOption[] = [
  { key: "manual", label: "Ручной порядок" },
  { key: "due-asc", label: "По сроку (раньше)" },
  { key: "due-desc", label: "По сроку (позже)" },
  { key: "priority-desc", label: "По приоритету" },
  { key: "title-asc", label: "По названию" }
];

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  critical: 5,
  urgent: 4,
  high: 3,
  med: 2,
  normal: 2,
  low: 1
};

/**
 * Парсит `date` карточки задачи. Поддерживает `DD.MM.YYYY` (источник demo-данных)
 * и ISO; при ошибке возвращает `+Infinity`, чтобы строка ушла в конец сортировки.
 */
function parseDate(raw: string): number {
  const ddmmyyyy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const t = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  }
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

export function buildTaskKanbanComparators<
  T extends TaskKanbanItem<C>,
  C extends string
>(): KanbanComparators<T> {
  return {
    "due-asc": (a, b) => parseDate(a.date) - parseDate(b.date),
    "due-desc": (a, b) => parseDate(b.date) - parseDate(a.date),
    "priority-desc": (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
    "title-asc": (a, b) => a.title.localeCompare(b.title, "ru")
  };
}

export function defaultTaskKanbanViewState(): KanbanCardViewState {
  const state: KanbanCardViewState = {};
  for (const f of TASK_KANBAN_VIEW_PROFILE.fields) state[f.id] = f.defaultOn;
  return state;
}
