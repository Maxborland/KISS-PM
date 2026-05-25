import type {
  GanttDependency,
  GanttDependencyEndpoint,
  GanttDependencyType,
  GanttRow
} from "./types";

export type DependencyIssue = {
  code: "self" | "duplicate" | "missing-row" | "cycle-pending";
  message: string;
};

export function dependencyTypeFromEndpoints(
  from: GanttDependencyEndpoint,
  to: GanttDependencyEndpoint
): GanttDependencyType {
  if (from === "finish" && to === "start") return "FS";
  if (from === "start" && to === "start") return "SS";
  if (from === "finish" && to === "finish") return "FF";
  return "SF";
}

/** Простая проверка цикла FS (frontend-only, не CPM). */
export function wouldCreateCycle(
  dependencies: GanttDependency[],
  fromId: string,
  toId: string
): boolean {
  const graph = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = graph.get(dep.fromId) ?? [];
    list.push(dep.toId);
    graph.set(dep.fromId, list);
  }
  const list = graph.get(fromId) ?? [];
  list.push(toId);
  graph.set(fromId, list);

  const visited = new Set<string>();
  const stack = [toId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === fromId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of graph.get(id) ?? []) stack.push(next);
  }
  return false;
}

export function createsDependencyCycle(
  dependencies: GanttDependency[],
  fromId: string,
  toId: string
): boolean {
  return wouldCreateCycle(dependencies, fromId, toId);
}

export function isDuplicateDependency(
  dependencies: GanttDependency[],
  fromId: string,
  toId: string,
  type: GanttDependencyType
): boolean {
  return dependencies.some(
    (d) => d.fromId === fromId && d.toId === toId && (d.type ?? "FS") === type
  );
}

export function canLinkRow(row: GanttRow | undefined): boolean {
  if (!row) return false;
  return row.kind === "task" || row.kind === "milestone";
}

export function validateDependency(
  dep: Pick<GanttDependency, "fromId" | "toId" | "type">,
  existing: GanttDependency[],
  rowIds: Set<string>
): DependencyIssue | undefined {
  if (dep.fromId === dep.toId) {
    return { code: "self", message: "Нельзя связать задачу саму с собой" };
  }
  if (!rowIds.has(dep.fromId) || !rowIds.has(dep.toId)) {
    return { code: "missing-row", message: "Не найдена строка для связи" };
  }
  const duplicate = existing.some(
    (d) => d.fromId === dep.fromId && d.toId === dep.toId && (d.type ?? "FS") === (dep.type ?? "FS")
  );
  if (duplicate) return { code: "duplicate", message: "Такая связь уже существует" };
  return undefined;
}

export function formatPredecessors(
  rowId: string,
  rows: GanttRow[],
  dependencies: GanttDependency[]
): string {
  const indexById = new Map(rows.map((r, i) => [r.id, i + 1]));
  const preds = dependencies
    .filter((d) => d.toId === rowId)
    .map((d) => {
      const num = indexById.get(d.fromId);
      const type = (d.type ?? "FS") as GanttDependencyType;
      const typeSuffix = type === "FS" ? "" : type;
      const lag = d.lagDays ?? 0;
      const lagSuffix = lag !== 0 ? `${lag > 0 ? "+" : ""}${lag}d` : "";
      return num ? `${num}${typeSuffix}${lagSuffix}` : "";
    })
    .filter(Boolean);
  return preds.length ? preds.join(",") : "—";
}

export function syncPredecessorLabels(rows: GanttRow[], dependencies: GanttDependency[]): GanttRow[] {
  return rows.map((row) => ({
    ...row,
    predecessors: formatPredecessors(row.id, rows, dependencies)
  }));
}

export type DependencyValidationResult =
  | { ok: true; type: GanttDependencyType }
  | { ok: false; message: string };

export function validateDependencyCreation(input: {
  fromId: string;
  fromEndpoint: GanttDependencyEndpoint;
  toId: string;
  toEndpoint: GanttDependencyEndpoint;
  dependencies: GanttDependency[];
  rows: GanttRow[];
  visibleRowIds: Set<string>;
}): DependencyValidationResult {
  const { fromId, fromEndpoint, toId, toEndpoint, dependencies, rows, visibleRowIds } = input;

  if (fromId === toId) {
    return { ok: false, message: "Нельзя связать задачу саму с собой" };
  }

  const fromRow = rows.find((r) => r.id === fromId);
  const toRow = rows.find((r) => r.id === toId);

  if (!fromRow || !toRow) {
    return { ok: false, message: "Не найдена строка для связи" };
  }

  if (!canLinkRow(fromRow)) {
    return { ok: false, message: "Для суммарных задач связь пока недоступна" };
  }
  if (!canLinkRow(toRow)) {
    return { ok: false, message: "Для суммарных задач связь пока недоступна" };
  }

  if (!visibleRowIds.has(toId)) {
    return { ok: false, message: "Нельзя связать скрытую задачу" };
  }

  const type = dependencyTypeFromEndpoints(fromEndpoint, toEndpoint);

  if (isDuplicateDependency(dependencies, fromId, toId, type)) {
    return { ok: false, message: "Такая связь уже существует" };
  }

  if (createsDependencyCycle(dependencies, fromId, toId)) {
    return { ok: false, message: "Такая связь создаёт циклическую зависимость" };
  }

  return { ok: true, type };
}
