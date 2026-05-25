import type { GanttDependency, GanttRow } from "./types";

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
  const index = rows.findIndex((r) => r.id === rowId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return rows;
  const copy = [...rows];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item!);
  return renumberWbs(copy);
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
  const index = rows.findIndex((r) => r.id === afterId);
  const copy = [...rows];
  copy.splice(index + 1, 0, template);
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
  const index = rows.findIndex((r) => r.id === anchorId);
  if (index < 0) return rows;
  const template = newTaskTemplate(rows[index]);
  const copy = [...rows];
  copy.splice(index + 1, 0, template);
  return renumberWbs(copy);
}

export function deleteRow(rows: GanttRow[], rowId: string, dependencies: GanttDependency[]) {
  const nextRows = renumberWbs(rows.filter((r) => r.id !== rowId));
  const nextDeps = dependencies.filter((d) => d.fromId !== rowId && d.toId !== rowId);
  return { rows: nextRows, dependencies: nextDeps };
}
