import { useState } from "react";
import { Kanban } from "../../widgets/kanban/kanban";
import {
  LandingTaskKanbanCard,
  type LandingTaskKanbanItem,
} from "../../widgets/kanban/landing-task-card";
import type { KanbanColumnDef } from "../../widgets/kanban/types";

/** Колонки = этапы управленческого контура (см. заголовок секции). */
type ControlColumnId = "signal" | "action" | "audit";

const COLUMNS: KanbanColumnDef<ControlColumnId>[] = [
  {
    id: "signal",
    title: "Сигнал",
    emptyLabel: "Нет открытых сигналов",
    tone: "neutral",
  },
  {
    id: "action",
    title: "Действие",
    emptyLabel: "Перетащите сигнал сюда",
    tone: "info",
  },
  {
    id: "audit",
    title: "Аудит",
    emptyLabel: "След появится после действия",
    tone: "success",
  },
];

const INITIAL: LandingTaskKanbanItem<ControlColumnId>[] = [
  {
    id: "SIG-4128",
    columnId: "signal",
    title: "Перегрев роли «Дизайн»",
    priority: "urgent",
    priorityLabel: "Высокий",
    meta: [{ label: "142% к плану" }, { label: "Прогноз: 3 недели" }],
    assignees: [{ initials: "АК", color: "c4" }],
    comments: 2,
    date: "сейчас",
  },
  {
    id: "SIG-4102",
    columnId: "signal",
    title: "Дедлайн приёмки под риском",
    priority: "normal",
    priorityLabel: "Средний",
    meta: [{ label: "Acceptance −3 дня" }],
    assignees: [{ initials: "ДИ", color: "c2" }],
    date: "12:04",
  },
  {
    id: "ACT-4128",
    columnId: "action",
    title: "Применить сбалансированный сценарий",
    priority: "high",
    priorityLabel: "К подтверждению",
    highlight: true,
    meta: [{ label: "Сжать спринт · роль «Дизайн»" }],
    assignees: [{ initials: "АК", color: "c4" }],
    date: "сегодня",
  },
  {
    id: "AUD-4127",
    columnId: "audit",
    title: "Сценарий применён · след № 4127",
    priority: "low",
    priorityLabel: "Записано",
    meta: [{ label: "112% → 94% · ведущий инженер" }],
    assignees: [{ initials: "АК", color: "c4" }],
    date: "вчера",
  },
];

function flatten(items: LandingTaskKanbanItem<ControlColumnId>[]) {
  return COLUMNS.flatMap((col) => items.filter((c) => c.columnId === col.id));
}

function moveItem(
  items: LandingTaskKanbanItem<ControlColumnId>[],
  id: string,
  toColumnId: ControlColumnId,
  toIndex: number,
) {
  const item = items.find((c) => c.id === id);
  if (!item) return items;
  const rest = items.filter((c) => c.id !== id);
  const by: Record<ControlColumnId, LandingTaskKanbanItem<ControlColumnId>[]> = {
    signal: [],
    action: [],
    audit: [],
  };
  for (const c of rest) by[c.columnId].push(c);
  by[toColumnId].splice(toIndex, 0, { ...item, columnId: toColumnId });
  return COLUMNS.flatMap((col) => by[col.id]);
}

function reorderItem(
  items: LandingTaskKanbanItem<ControlColumnId>[],
  columnId: ControlColumnId,
  fromIndex: number,
  toIndex: number,
) {
  const by: Record<ControlColumnId, LandingTaskKanbanItem<ControlColumnId>[]> = {
    signal: [],
    action: [],
    audit: [],
  };
  for (const c of items) by[c.columnId].push(c);
  const col = [...by[columnId]];
  const [moved] = col.splice(fromIndex, 1);
  if (!moved) return items;
  col.splice(toIndex, 0, moved);
  by[columnId] = col;
  return COLUMNS.flatMap((colDef) => by[colDef.id]);
}

export default function LandingKanbanShowcase() {
  const [items, setItems] = useState(INITIAL);
  const sorted = flatten(items);

  return (
    <div className="product-surface" data-testid="landing-kanban-showcase">
      <p className="kanban-legend" aria-hidden="true">
        <span>Сигнал</span>
        <span aria-hidden="true">→</span>
        <span>Действие</span>
        <span aria-hidden="true">→</span>
        <span>Аудит</span>
      </p>
      <Kanban<LandingTaskKanbanItem<ControlColumnId>, ControlColumnId>
        columns={COLUMNS}
        items={sorted}
        className="kanban--landing kanban--control"
        renderCard={(item, ctx) => (
          <LandingTaskKanbanCard
            item={item}
            draggable={ctx.draggable}
            isDragging={ctx.isDragging}
          />
        )}
        onItemMove={(id, toCol, toIndex) =>
          setItems((prev) => moveItem(prev, id, toCol, toIndex))
        }
        onItemReorder={(columnId, fromIndex, toIndex) =>
          setItems((prev) => reorderItem(prev, columnId, fromIndex, toIndex))
        }
      />
    </div>
  );
}
