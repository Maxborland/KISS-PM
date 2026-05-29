"use client";

import { useMemo } from "react";

import { sortKanbanColumnItems, type KanbanComparators } from "@/widgets/kanban/kanban-column-sort";
import type {
  KanbanColumnDef,
  KanbanColumnSortState,
  KanbanItem
} from "@/widgets/kanban/types";

/**
 * Возвращает отсортированный по колонкам массив:
 *   - применяет `comparators[columnSort[col]]` к каждой колонке;
 *   - сохраняет внешний порядок колонок (как в `columns`);
 *   - при `manual` или отсутствии компаратора сохраняет исходный порядок.
 */
export function useKanbanOrderedItems<T extends KanbanItem<C>, C extends string>(
  columns: KanbanColumnDef<C>[],
  items: T[],
  columnSort: KanbanColumnSortState<C> | undefined,
  comparators: KanbanComparators<T>
): T[] {
  return useMemo(() => {
    if (columns.length === 0) return items;
    const byCol = new Map<C, T[]>();
    for (const col of columns) byCol.set(col.id, []);
    for (const item of items) {
      const bucket = byCol.get(item.columnId);
      if (bucket) bucket.push(item);
    }
    const out: T[] = [];
    for (const col of columns) {
      const bucket = byCol.get(col.id) ?? [];
      const key = columnSort?.[col.id] ?? "manual";
      out.push(...sortKanbanColumnItems(bucket, key, comparators));
    }
    return out;
  }, [columns, items, columnSort, comparators]);
}
