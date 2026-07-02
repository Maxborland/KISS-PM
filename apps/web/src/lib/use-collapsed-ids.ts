import { useCallback, useState } from "react";

/** Состояние свёрнутых строк WBS/групп + стабильный toggle. Общее для Гантта и матрицы ресурсов. */
export function useCollapsedIds() {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const toggleCollapse = useCallback((rowId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);
  return { collapsedIds, toggleCollapse };
}
