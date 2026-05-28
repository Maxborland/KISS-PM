import type { GanttDependency, GanttRow } from "./types";
import { uniqueGanttId } from "./gantt-id";

export {
  formatPredecessorText,
  parsePredecessorText,
  parsePredecessorTextError,
  type GanttDependencyType,
  type ParsedPredecessorToken
} from "@/lib/gantt/predecessor-text";

import type { ParsedPredecessorToken } from "@/lib/gantt/predecessor-text";

export function tokensToDependencies(
  rowId: string,
  tokens: ParsedPredecessorToken[],
  rows: GanttRow[],
  existing: GanttDependency[]
): { dependencies: GanttDependency[]; error?: string } {
  const visibleIndex = new Map(rows.map((r, i) => [i + 1, r.id]));
  const next = existing.filter((d) => d.toId !== rowId);
  const rowIds = new Set(rows.map((r) => r.id));
  const usedDependencyIds = new Set(existing.map((d) => d.id));

  for (const token of tokens) {
    const fromId = visibleIndex.get(token.rowNumber);
    if (!fromId) return { dependencies: existing, error: `Нет строки №${token.rowNumber}` };
    if (fromId === rowId) return { dependencies: existing, error: "Задача не может зависеть от себя" };
    if (!rowIds.has(fromId)) return { dependencies: existing, error: "Не найдена строка для связи" };

    const duplicate = next.some(
      (d) =>
        d.fromId === fromId &&
        d.toId === rowId &&
        (d.type ?? "FS") === token.type &&
        (d.lagDays ?? 0) === token.lagDays
    );
    if (duplicate) return { dependencies: existing, error: "Такая связь уже есть" };

    const id = uniqueGanttId(
      "dep",
      usedDependencyIds,
      `dep-${fromId}-${rowId}-${token.type}-${token.lagDays ?? 0}`
    );
    usedDependencyIds.add(id);

    next.push({
      id,
      fromId,
      toId: rowId,
      type: token.type,
      lagDays: token.lagDays
    });
  }

  return { dependencies: next };
}
