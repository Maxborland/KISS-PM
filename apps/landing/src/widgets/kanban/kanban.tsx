"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { cn } from "../../lib/cn";
import type {
  KanbanCardRenderContext,
  KanbanColumnDef,
  KanbanDragColumnData,
  KanbanDragItemData,
  KanbanItem,
  KanbanProps,
} from "./types";

function groupByColumn<T extends KanbanItem<C>, C extends string>(
  columns: KanbanColumnDef<C>[],
  items: T[],
): Record<C, T[]> {
  const map = {} as Record<C, T[]>;
  for (const col of columns) map[col.id] = [];
  for (const item of items) {
    if (map[item.columnId] != null) map[item.columnId].push(item);
  }
  return map;
}

function resolveColumnFromOver<T extends KanbanItem<C>, C extends string>(
  overId: string,
  items: T[],
  columns: KanbanColumnDef<C>[],
): C | null {
  const col = columns.find((c) => c.id === overId);
  if (col) return col.id;
  const item = items.find((i) => i.id === overId);
  return item ? item.columnId : null;
}

const kanbanCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

const kanbanDropAnimation: DropAnimation = {
  duration: 260,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.28",
      },
    },
  }),
};

const EMPTY_FIELDS: ReadonlySet<string> = new Set<string>();

export function Kanban<T extends KanbanItem<C>, C extends string = string>({
  columns,
  items,
  renderCard,
  onItemMove,
  onItemReorder,
  visibleFields,
  disableDnd = false,
  showCount = true,
  boardVariant = "default",
  className,
}: KanbanProps<T, C>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
  );
  const byColumn = useMemo(() => groupByColumn(columns, items), [columns, items]);
  const dndEnabled = !disableDnd && (Boolean(onItemMove) || Boolean(onItemReorder));
  const visible = visibleFields ?? EMPTY_FIELDS;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<C | null>(null);

  const activeItem = useMemo(
    () => (activeId ? (items.find((i) => i.id === activeId) ?? null) : null),
    [activeId, items],
  );

  const handleStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const data = event.active.data.current as KanbanDragItemData<C> | undefined;
    if (data?.type === "item") setOverColumnId(data.columnId);
  }, []);

  const handleOver = useCallback(
    (event: DragOverEvent) => {
      const over = event.over;
      if (!over) {
        setOverColumnId(null);
        return;
      }
      const overData = over.data.current as
        | KanbanDragItemData<C>
        | KanbanDragColumnData<C>
        | undefined;
      if (overData?.type === "column") {
        setOverColumnId(overData.columnId);
        return;
      }
      const colId = resolveColumnFromOver(String(over.id), items, columns);
      if (colId) setOverColumnId(colId);
    },
    [items, columns],
  );

  const handleEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOverColumnId(null);

      const { active, over } = event;
      if (!over) return;
      const activeData = active.data.current as KanbanDragItemData<C> | undefined;
      if (!activeData || activeData.type !== "item") return;

      const movingId = String(active.id);
      const fromColumnId = activeData.columnId;
      const fromIndex = byColumn[fromColumnId].findIndex((i) => i.id === movingId);
      if (fromIndex < 0) return;

      const overId = String(over.id);
      const overData = over.data.current as
        | KanbanDragItemData<C>
        | KanbanDragColumnData<C>
        | undefined;

      let toColumnId: C;
      let toIndex: number;

      if (overData?.type === "column") {
        toColumnId = overData.columnId;
        toIndex = byColumn[toColumnId].length;
      } else {
        const resolved = resolveColumnFromOver(overId, items, columns);
        if (!resolved) return;
        toColumnId = resolved;
        const overIndex = byColumn[toColumnId].findIndex((i) => i.id === overId);
        toIndex = overIndex >= 0 ? overIndex : byColumn[toColumnId].length;
      }

      if (fromColumnId === toColumnId) {
        if (fromIndex !== toIndex) onItemReorder?.(fromColumnId, fromIndex, toIndex);
      } else {
        onItemMove?.(movingId, toColumnId, toIndex);
      }
    },
    [byColumn, columns, items, onItemMove, onItemReorder],
  );

  const handleCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
  }, []);

  const board = (
    <div
      className={cn("kanban", boardVariant === "funnel" && "kanban--funnel", className)}
      data-board-variant={boardVariant}
    >
      {columns.map((column) => (
        <KanbanColumnView
          key={column.id}
          column={column}
          columnItems={byColumn[column.id]}
          renderCard={renderCard}
          visibleFields={visible}
          disableDnd={!dndEnabled}
          showCount={showCount}
          isOverColumn={overColumnId === column.id}
        />
      ))}
    </div>
  );

  if (!dndEnabled) return board;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
      {board}
      <DragOverlay
        className="kanban-drag-overlay"
        dropAnimation={kanbanDropAnimation}
        modifiers={[snapCenterToCursor]}
      >
        {activeItem
          ? renderCard(activeItem, { draggable: true, isDragging: true, visibleFields: visible })
          : null}
      </DragOverlay>
    </DndContext>
  );
}

type KanbanColumnViewProps<T extends KanbanItem<C>, C extends string> = {
  column: KanbanColumnDef<C>;
  columnItems: T[];
  renderCard: (item: T, ctx: KanbanCardRenderContext) => ReactNode;
  visibleFields: ReadonlySet<string>;
  disableDnd: boolean;
  showCount: boolean;
  isOverColumn: boolean;
};

function KanbanColumnView<T extends KanbanItem<C>, C extends string>({
  column,
  columnItems,
  renderCard,
  visibleFields,
  disableDnd,
  showCount,
  isOverColumn,
}: KanbanColumnViewProps<T, C>) {
  const drop = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id } satisfies KanbanDragColumnData<C>,
  });
  const itemIds = useMemo(() => columnItems.map((i) => i.id), [columnItems]);
  const count = columnItems.length;
  const showOver = !disableDnd && isOverColumn;

  return (
    <div
      ref={drop.setNodeRef}
      className="kanban-col"
      data-droppable={disableDnd ? undefined : "true"}
      data-over={showOver ? "true" : undefined}
      data-col-id={column.id}
    >
      <div className="kanban-col__head">
        <span className="kanban-col__title">
          {column.title}
          {showCount ? <span className="badge badge--soft">{count}</span> : null}
        </span>
      </div>
      <div className="kanban-col__body">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy} disabled={disableDnd}>
          {columnItems.length === 0 ? (
            <p className="kanban-col__empty">{column.emptyLabel ?? "Нет карточек"}</p>
          ) : (
            columnItems.map((item) => (
              <KanbanSortableItem
                key={item.id}
                item={item}
                disableDnd={disableDnd}
                renderCard={renderCard}
                visibleFields={visibleFields}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function KanbanSortableItem<T extends KanbanItem<C>, C extends string>({
  item,
  disableDnd,
  renderCard,
  visibleFields,
}: {
  item: T;
  disableDnd: boolean;
  renderCard: (item: T, ctx: KanbanCardRenderContext) => ReactNode;
  visibleFields: ReadonlySet<string>;
}) {
  const sortable = useSortable({
    id: item.id,
    data: { type: "item", columnId: item.columnId } satisfies KanbanDragItemData<C>,
    disabled: disableDnd,
  });

  const style = disableDnd
    ? undefined
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.isDragging ? undefined : sortable.transition,
      };

  return (
    <div
      ref={sortable.setNodeRef}
      className="kanban-item-slot"
      style={style}
      data-item-id={item.id}
      data-dragging={sortable.isDragging ? "true" : undefined}
      {...(disableDnd ? {} : sortable.attributes)}
      {...(disableDnd ? {} : sortable.listeners)}
    >
      {renderCard(item, {
        draggable: !disableDnd,
        isDragging: sortable.isDragging,
        visibleFields,
      })}
    </div>
  );
}
