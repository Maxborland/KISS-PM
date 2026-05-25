import type { KanbanColumnSortKey, KanbanItem } from "@/widgets/kanban/types";

/**
 * Чистый компаратор — не знает про доменные поля. Потребитель передаёт
 * `comparators[sortKey]`, реализованный поверх своей модели карточки.
 */
export type KanbanItemComparator<T> = (a: T, b: T) => number;

export type KanbanComparators<T> = Record<string, KanbanItemComparator<T>>;

/**
 * Сортирует элементы одной колонки. При `manual` или отсутствии компаратора
 * возвращает исходный порядок (с учётом `sortOrder`, если он есть).
 */
export function sortKanbanColumnItems<T extends KanbanItem<C>, C extends string>(
  items: T[],
  key: KanbanColumnSortKey,
  comparators: KanbanComparators<T>
): T[] {
  if (key === "manual") {
    return stableManualOrder(items);
  }
  const cmp = comparators[key];
  if (!cmp) return stableManualOrder(items);
  return [...items].sort(cmp);
}

function stableManualOrder<T extends KanbanItem<C>, C extends string>(items: T[]): T[] {
  if (items.length === 0) return items;
  const hasOrder = items.some((i) => typeof i.sortOrder === "number");
  if (!hasOrder) return items;
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
