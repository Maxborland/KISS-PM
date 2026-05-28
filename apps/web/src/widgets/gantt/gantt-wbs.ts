import type { GanttDependency, GanttRow } from "./types";
import { rowSubtreeRange } from "./gantt-row-tree";

export function renumberWbs(rows: GanttRow[]): GanttRow[] {
  const counters = [0, 0, 0, 0];
  return rows.map((row) => {
    if (row.kind === "milestone") {
      const m = row.wbs?.startsWith("M") ? row.wbs : `M${++counters[0]!}`;
      return { ...row, wbs: m };
    }
    const level = Math.min(row.level, 3);
    counters[level]! += 1;
    for (let i = level + 1; i < counters.length; i += 1) counters[i] = 0;
    const parts = counters.slice(0, level + 1).filter((n) => n > 0);
    return { ...row, wbs: parts.join(".") };
  });
}

/** Collapsed summary levels on a stack; descendants are hidden until subtree ends. */
export function hiddenRowIds(rows: GanttRow[]): Set<string> {
  const hidden = new Set<string>();
  const collapsedLevels: number[] = [];

  for (const row of rows) {
    while (collapsedLevels.length > 0 && row.level <= collapsedLevels[collapsedLevels.length - 1]!) {
      collapsedLevels.pop();
    }

    const parentLevel = collapsedLevels[collapsedLevels.length - 1];
    if (parentLevel !== undefined && row.level > parentLevel) {
      hidden.add(row.id);
      continue;
    }

    if (row.collapsible && row.collapsed) {
      collapsedLevels.push(row.level);
    }
  }

  return hidden;
}

export function visibleRows(rows: GanttRow[]): GanttRow[] {
  const hidden = hiddenRowIds(rows);
  return rows.filter((row) => !hidden.has(row.id));
}

export function visibleDependencies(
  dependencies: GanttDependency[],
  visible: GanttRow[]
): GanttDependency[] {
  const ids = new Set(visible.map((r) => r.id));
  return dependencies.filter((d) => ids.has(d.fromId) && ids.has(d.toId));
}

export function toggleRowCollapsed(rows: GanttRow[], rowId: string): GanttRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    if (row.kind !== "summary" && !row.collapsible) return row;
    return { ...row, collapsible: true, collapsed: !row.collapsed };
  });
}

export function indentRow(rows: GanttRow[], rowId: string): GanttRow[] {
  const index = rows.findIndex((r) => r.id === rowId);
  if (index <= 0) return rows;
  const row = rows[index]!;
  if (row.level >= 3) return rows;
  const next = rows.map((r, i) => (i === index ? { ...r, level: (r.level + 1) as GanttRow["level"] } : r));
  return renumberWbs(next);
}

export function outdentRow(rows: GanttRow[], rowId: string): GanttRow[] {
  const index = rows.findIndex((r) => r.id === rowId);
  if (index < 0) return rows;
  const row = rows[index]!;
  if (row.level <= 0) return rows;
  const next = rows.map((r, i) => (i === index ? { ...r, level: (r.level - 1) as GanttRow["level"] } : r));
  return renumberWbs(next);
}

export function moveRow(rows: GanttRow[], rowId: string, direction: -1 | 1): GanttRow[] {
  const range = rowSubtreeRange(rows, rowId);
  if (!range) return rows;

  const { start: index, end } = range;
  const row = rows[index]!;

  if (direction < 0) {
    const previousStart = previousSiblingBlockStart(rows, index);
    if (previousStart === null) return rows;
    return renumberWbs([
      ...rows.slice(0, previousStart),
      ...rows.slice(index, end),
      ...rows.slice(previousStart, index),
      ...rows.slice(end)
    ]);
  }

  const nextStart = end;
  if (nextStart >= rows.length || rows[nextStart]!.level < row.level) return rows;
  const nextRange = rowSubtreeRange(rows, rows[nextStart]!.id);
  if (!nextRange) return rows;
  return renumberWbs([
    ...rows.slice(0, index),
    ...rows.slice(nextStart, nextRange.end),
    ...rows.slice(index, end),
    ...rows.slice(nextRange.end)
  ]);
}

function previousSiblingBlockStart(rows: GanttRow[], index: number): number | null {
  const level = rows[index]!.level;
  let cursor = index - 1;
  if (cursor < 0 || rows[cursor]!.level < level) return null;
  while (cursor > 0 && rows[cursor]!.level > level) cursor -= 1;
  return rows[cursor]!.level === level ? cursor : null;
}

function newTaskTemplate(near?: GanttRow): GanttRow {
  return {
    id: `t-${Date.now()}`,
    level: near?.level ?? 1,
    kind: "task",
    name: "Новая задача",
    startDay: near?.startDay ?? 0,
    durationDays: 3,
    progress: 0
  };
}

export function createTaskRow(rows: GanttRow[], afterId?: string): GanttRow[] {
  const template = newTaskTemplate(afterId ? rows.find((r) => r.id === afterId) : undefined);
  if (!afterId) return renumberWbs([...rows, template]);
  const range = rowSubtreeRange(rows, afterId);
  if (!range) return renumberWbs([...rows, template]);
  const copy = [...rows];
  copy.splice(range.end, 0, template);
  return renumberWbs(copy);
}

export function insertTaskAbove(rows: GanttRow[], anchorId: string): GanttRow[] {
  const index = rows.findIndex((r) => r.id === anchorId);
  if (index < 0) return rows;
  const template = newTaskTemplate(rows[index]);
  const copy = [...rows];
  copy.splice(index, 0, template);
  return renumberWbs(copy);
}

export function insertTaskBelow(rows: GanttRow[], anchorId: string): GanttRow[] {
  const range = rowSubtreeRange(rows, anchorId);
  if (!range) return rows;
  const template = newTaskTemplate(rows[range.start]);
  const copy = [...rows];
  copy.splice(range.end, 0, template);
  return renumberWbs(copy);
}

export function deleteRow(rows: GanttRow[], rowId: string, dependencies: GanttDependency[]) {
  const range = rowSubtreeRange(rows, rowId);
  if (!range) return { rows, dependencies };
  const deletedIds = new Set(rows.slice(range.start, range.end).map((row) => row.id));
  const nextRows = renumberWbs(rows.filter((r) => !deletedIds.has(r.id)));
  const nextDeps = dependencies.filter((d) => !deletedIds.has(d.fromId) && !deletedIds.has(d.toId));
  return { rows: nextRows, dependencies: nextDeps };
}
