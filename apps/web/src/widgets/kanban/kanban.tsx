"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import type {
  KanbanCardRenderContext,
  KanbanColumnAction,
  KanbanColumnDef,
  KanbanColumnSortKey,
  KanbanDragColumnData,
  KanbanDragItemData,
  KanbanItem,
  KanbanProps,
  KanbanSortOption
} from "@/widgets/kanban/types";

function groupByColumn<T extends KanbanItem<C>, C extends string>(
  columns: KanbanColumnDef<C>[],
  items: T[]
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
  columns: KanbanColumnDef<C>[]
): C | null {
  const col = columns.find((c) => c.id === overId);
  if (col) return col.id;
  const item = items.find((i) => i.id === overId);
  return item ? item.columnId : null;
}

/**
 * Collision detection that prefers column container when pointer is
 * inside it but not over any specific card — gives a stable cross-column
 * drop target even when the source column has more items than the target.
 */
const kanbanCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

const EMPTY_FIELDS: ReadonlySet<string> = new Set<string>();

export function Kanban<T extends KanbanItem<C>, C extends string = string>({
  columns,
  items,
  renderCard,
  renderColumnHeader,
  renderColumnFooter,
  renderColumnEmpty,
  onItemMove,
  isItemDragDisabled,
  onItemReorder,
  onColumnAction,
  sortOptions,
  columnSort,
  onColumnSortChange,
  visibleFields,
  disableDnd = false,
  showCount = true,
  boardVariant = "default",
  className
}: KanbanProps<T, C>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const byColumn = useMemo(() => groupByColumn(columns, items), [columns, items]);
  const dndEnabled = !disableDnd && (Boolean(onItemMove) || Boolean(onItemReorder));
  const visible = visibleFields ?? EMPTY_FIELDS;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<C | null>(null);

  const activeItem = useMemo(
    () => (activeId ? items.find((i) => i.id === activeId) ?? null : null),
    [activeId, items]
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
    [items, columns]
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

      const overItemId = overData?.type === "item" ? overId : undefined;

      if (fromColumnId === toColumnId) {
        if (fromIndex !== toIndex) {
          onItemReorder?.(fromColumnId, fromIndex, toIndex, movingId, overItemId);
        }
      } else {
        onItemMove?.(movingId, toColumnId, toIndex, overItemId);
      }
    },
    [byColumn, columns, items, onItemMove, onItemReorder]
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
          {...(renderColumnHeader ? { renderColumnHeader } : {})}
          {...(renderColumnFooter ? { renderColumnFooter } : {})}
          {...(renderColumnEmpty ? { renderColumnEmpty } : {})}
          {...(onColumnAction ? { onColumnAction } : {})}
          {...(sortOptions ? { sortOptions } : {})}
          sortKey={columnSort?.[column.id] ?? "manual"}
          {...(onColumnSortChange ? { onColumnSortChange } : {})}
          visibleFields={visible}
          {...(isItemDragDisabled ? { isItemDragDisabled } : {})}
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
      <DragOverlay dropAnimation={null}>
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
  renderColumnHeader?: KanbanProps<T, C>["renderColumnHeader"];
  renderColumnFooter?: KanbanProps<T, C>["renderColumnFooter"];
  renderColumnEmpty?: KanbanProps<T, C>["renderColumnEmpty"];
  onColumnAction?: KanbanProps<T, C>["onColumnAction"];
  isItemDragDisabled?: KanbanProps<T, C>["isItemDragDisabled"];
  sortOptions?: KanbanSortOption[];
  sortKey: KanbanColumnSortKey;
  onColumnSortChange?: (columnId: C, key: KanbanColumnSortKey) => void;
  visibleFields: ReadonlySet<string>;
  disableDnd: boolean;
  showCount: boolean;
  isOverColumn: boolean;
};

function KanbanColumnView<T extends KanbanItem<C>, C extends string>({
  column,
  columnItems,
  renderCard,
  renderColumnHeader,
  renderColumnFooter,
  renderColumnEmpty,
  onColumnAction,
  isItemDragDisabled,
  sortOptions,
  sortKey,
  onColumnSortChange,
  visibleFields,
  disableDnd,
  showCount,
  isOverColumn
}: KanbanColumnViewProps<T, C>) {
  const drop = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id } satisfies KanbanDragColumnData<C>
  });
  const itemIds = useMemo(() => columnItems.map((i) => i.id), [columnItems]);
  const count = columnItems.length;
  const showOver = !disableDnd && isOverColumn;

  const colTone = column.tone ?? "neutral";

  return (
    <div
      ref={drop.setNodeRef}
      className="kanban-col"
      data-droppable={disableDnd ? undefined : "true"}
      data-over={showOver ? "true" : undefined}
      data-col-id={column.id}
      data-col-tone={colTone}
    >
      <div className="kanban-col__accent" aria-hidden />
      <div className="kanban-col__head">
        {renderColumnHeader ? (
          renderColumnHeader(column, count)
        ) : (
          <span className="kanban-col__title">
            {column.title}
            {showCount ? <Badge variant="secondary">{count}</Badge> : null}
          </span>
        )}
        <KanbanColumnMenu
          {...(onColumnAction ? { onColumnAction: (action) => onColumnAction(column.id, action) } : {})}
          {...(sortOptions ? { sortOptions } : {})}
          sortKey={sortKey}
          {...(onColumnSortChange
            ? { onSortChange: (key: KanbanColumnSortKey) => onColumnSortChange(column.id, key) }
            : {})}
        />
      </div>
      <div className="kanban-col__body">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy} disabled={disableDnd}>
          {columnItems.length === 0 ? (
            renderColumnEmpty ? (
              renderColumnEmpty(column)
            ) : (
              <p className="kanban-col__empty u-text-xs u-text-muted">
                {column.emptyLabel ?? "Нет карточек"}
              </p>
            )
          ) : (
            columnItems.map((item) => (
              <KanbanSortableItem
                key={item.id}
                item={item}
                disableDnd={disableDnd}
                {...(isItemDragDisabled ? { isItemDragDisabled } : {})}
                renderCard={renderCard}
                visibleFields={visibleFields}
              />
            ))
          )}
        </SortableContext>
      </div>
      {renderColumnFooter ? <div className="kanban-col__footer">{renderColumnFooter(column)}</div> : null}
    </div>
  );
}

function KanbanSortableItem<T extends KanbanItem<C>, C extends string>({
  item,
  disableDnd,
  isItemDragDisabled,
  renderCard,
  visibleFields
}: {
  item: T;
  disableDnd: boolean;
  isItemDragDisabled?: (item: T) => boolean;
  renderCard: (item: T, ctx: KanbanCardRenderContext) => ReactNode;
  visibleFields: ReadonlySet<string>;
}) {
  const itemDragDisabled = disableDnd || Boolean(isItemDragDisabled?.(item));
  const sortable = useSortable({
    id: item.id,
    data: { type: "item", columnId: item.columnId } satisfies KanbanDragItemData<C>,
    disabled: itemDragDisabled
  });

  const style = itemDragDisabled
    ? undefined
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition
      };

  return (
    <div
      ref={sortable.setNodeRef}
      className="kanban-item-slot"
      style={style}
      data-item-id={item.id}
      data-dragging={sortable.isDragging ? "true" : undefined}
      {...(itemDragDisabled ? {} : sortable.attributes)}
      {...(itemDragDisabled ? {} : sortable.listeners)}
    >
      {renderCard(item, {
        draggable: !itemDragDisabled,
        isDragging: sortable.isDragging,
        visibleFields
      })}
    </div>
  );
}

type KanbanColumnMenuProps = {
  onColumnAction?: (action: KanbanColumnAction) => void;
  sortOptions?: KanbanSortOption[];
  sortKey: KanbanColumnSortKey;
  onSortChange?: (key: KanbanColumnSortKey) => void;
};

function KanbanColumnMenu({
  onColumnAction,
  sortOptions,
  sortKey,
  onSortChange
}: KanbanColumnMenuProps) {
  const hasSort = Boolean(sortOptions && onSortChange);
  const hasAction = Boolean(onColumnAction);

  if (!hasSort && !hasAction) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Действия колонки"
        disabled
        title="Демо Storybook: действия колонки доступны в режиме доски с обработчиком"
      >
        <MoreHorizontal className="size-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Действия колонки">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hasSort && sortOptions && onSortChange ? (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Сортировка</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortKey}
                  onValueChange={(value) => onSortChange(value as KanbanColumnSortKey)}
                >
                  {sortOptions.map((opt) => (
                    <DropdownMenuRadioItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {hasAction ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}
        {hasAction && onColumnAction ? (
          <>
            <DropdownMenuItem onSelect={() => onColumnAction("rename")}>Переименовать</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onColumnAction("wip")}>Лимит WIP</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onColumnAction("add")}>Добавить карточку</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
