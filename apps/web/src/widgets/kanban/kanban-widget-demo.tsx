"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Kanban,
  KanbanCardViewMenu,
  TASK_KANBAN_SORT_OPTIONS,
  TASK_KANBAN_VIEW_PROFILE,
  TaskKanbanCard,
  buildTaskKanbanComparators,
  defaultTaskKanbanViewState,
  resolveVisibleFields,
  useKanbanOrderedItems,
  type KanbanColumnAction,
  type KanbanColumnDef,
  type KanbanColumnSortKey,
  type KanbanColumnSortState,
  type TaskKanbanItem
} from "@/widgets/kanban";

type DemoColumnId = "backlog" | "in-progress" | "done";

export type DemoKanbanItem = TaskKanbanItem<DemoColumnId>;

const DEMO_COLUMNS: KanbanColumnDef<DemoColumnId>[] = [
  { id: "backlog", title: "Бэклог", emptyLabel: "Нет задач", tone: "neutral" },
  { id: "in-progress", title: "В работе", emptyLabel: "Нет задач", tone: "info" },
  { id: "done", title: "Готово", emptyLabel: "Нет задач за сегодня", tone: "success" }
];

const DEMO_LABEL: Record<DemoColumnId, string> = {
  backlog: "Бэклог",
  "in-progress": "В работе",
  done: "Готово"
};

const DEMO_INITIAL: DemoKanbanItem[] = [
  {
    id: "MDS-39",
    columnId: "backlog",
    title: "Новая страница продукта",
    priority: "urgent",
    priorityLabel: "Срочно",
    meta: [{ label: "Новая Homepage" }, { label: "Срок: 29 июля" }],
    assignees: [{ initials: "ИИ", color: "c1" }],
    comments: 13,
    date: "30.05.2024"
  },
  {
    id: "MDS-2",
    columnId: "in-progress",
    title: "Презентация для клиента",
    priority: "low",
    priorityLabel: "Низкий",
    highlight: true,
    assignees: [
      { initials: "КБ", color: "c4" },
      { initials: "МД", color: "c5" }
    ],
    comments: 7,
    date: "31.05.2024"
  },
  {
    id: "MDS-40",
    columnId: "backlog",
    title: "Подготовить смету этапа 2",
    priority: "normal",
    priorityLabel: "Обычный",
    assignees: [{ initials: "АП", color: "c2" }],
    comments: 2,
    date: "01.06.2024"
  }
];

function flatten(items: DemoKanbanItem[]): DemoKanbanItem[] {
  return DEMO_COLUMNS.flatMap((col) => items.filter((c) => c.columnId === col.id));
}

function moveItem(items: DemoKanbanItem[], id: string, toColumnId: DemoColumnId, toIndex: number) {
  const item = items.find((c) => c.id === id);
  if (!item) return items;
  const rest = items.filter((c) => c.id !== id);
  const by: Record<DemoColumnId, DemoKanbanItem[]> = { backlog: [], "in-progress": [], done: [] };
  for (const c of rest) by[c.columnId].push(c);
  by[toColumnId].splice(toIndex, 0, { ...item, columnId: toColumnId });
  return DEMO_COLUMNS.flatMap((col) => by[col.id]);
}

function reorderItem(
  items: DemoKanbanItem[],
  columnId: DemoColumnId,
  fromIndex: number,
  toIndex: number
) {
  const by: Record<DemoColumnId, DemoKanbanItem[]> = { backlog: [], "in-progress": [], done: [] };
  for (const c of items) by[c.columnId].push(c);
  by[columnId] = arrayMove(by[columnId], fromIndex, toIndex);
  return DEMO_COLUMNS.flatMap((col) => by[col.id]);
}

/**
 * Демо generic `<Kanban>` с `TaskKanbanCard` — эталон для Storybook и для
 * потребителей (my-work-block и др.), которые подключают тот же виджет
 * со своим `renderCard` / drawer / API.
 */
export function KanbanWidgetDemo() {
  const [items, setItems] = useState<DemoKanbanItem[]>(DEMO_INITIAL);
  const [columnSort, setColumnSort] = useState<KanbanColumnSortState<DemoColumnId>>({});
  const [cardView, setCardView] = useState(() => defaultTaskKanbanViewState());

  const ordered = useMemo(() => flatten(items), [items]);
  const comparators = useMemo(() => buildTaskKanbanComparators<DemoKanbanItem, DemoColumnId>(), []);
  const sorted = useKanbanOrderedItems(DEMO_COLUMNS, ordered, columnSort, comparators);
  const visibleFields = useMemo(
    () => resolveVisibleFields(TASK_KANBAN_VIEW_PROFILE, cardView),
    [cardView]
  );

  const handleColumnAction = (columnId: DemoColumnId, action: KanbanColumnAction) => {
    const labels: Record<KanbanColumnAction, string> = {
      rename: "Переименовать",
      wip: "Лимит WIP",
      add: "Добавить карточку"
    };
    toast.info(`${labels[action]} — ${DEMO_LABEL[columnId]}`, {
      description: "Демо Storybook: действие зафиксировано локально."
    });
  };

  const handleColumnSortChange = (columnId: DemoColumnId, key: KanbanColumnSortKey) => {
    setColumnSort((prev) => ({ ...prev, [columnId]: key }));
  };

  const handleReorder = (columnId: DemoColumnId, fromIndex: number, toIndex: number) => {
    if ((columnSort[columnId] ?? "manual") !== "manual") {
      setColumnSort((prev) => ({ ...prev, [columnId]: "manual" }));
      toast.info("Ручной порядок", {
        description: `Колонка «${DEMO_LABEL[columnId]}» переключена на ручную сортировку.`
      });
    }
    setItems((prev) => reorderItem(prev, columnId, fromIndex, toIndex));
  };

  return (
    <div className="u-flex u-flex-col u-gap-3" data-testid="kanban-widget-demo">
      <div className="view-toolbar">
        <KanbanCardViewMenu
          profile={TASK_KANBAN_VIEW_PROFILE}
          value={cardView}
          onChange={setCardView}
        />
      </div>
      <Kanban<DemoKanbanItem, DemoColumnId>
        columns={DEMO_COLUMNS}
        items={sorted}
        visibleFields={visibleFields}
        sortOptions={TASK_KANBAN_SORT_OPTIONS}
        columnSort={columnSort}
        onColumnSortChange={handleColumnSortChange}
        renderCard={(item, ctx) => (
          <TaskKanbanCard
            item={item}
            draggable={ctx.draggable}
            isDragging={ctx.isDragging}
            visibleFields={ctx.visibleFields}
            onOpen={(id) => toast.info(`Открыть карточку ${id}`)}
          />
        )}
        onItemMove={(id, toCol, toIndex) => setItems((prev) => moveItem(prev, id, toCol, toIndex))}
        onItemReorder={handleReorder}
        onColumnAction={handleColumnAction}
      />
    </div>
  );
}
