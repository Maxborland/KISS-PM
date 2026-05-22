import type { PlanningGanttTaskRow } from "../types/viewModel";

export type PlanningTreeRow = {
  id: string;
  depth: number;
  wbsCode: string;
};

export type PlanningTreeIndex = {
  rowsById: Map<string, PlanningGanttTaskRow>;
  childIdsByParentId: Map<string | null, string[]>;
  rootIds: string[];
};

export function buildPlanningTreeIndex(rows: readonly PlanningGanttTaskRow[]): PlanningTreeIndex {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const childIdsByParentId = new Map<string | null, string[]>();

  for (const row of rows) {
    const parentId = row.parentTaskId !== null && rowsById.has(row.parentTaskId) ? row.parentTaskId : null;
    childIdsByParentId.set(parentId, [...(childIdsByParentId.get(parentId) ?? []), row.id]);
  }

  for (const [parentId, childIds] of childIdsByParentId) {
    childIdsByParentId.set(parentId, childIds.sort((leftId, rightId) => {
      const left = rowsById.get(leftId);
      const right = rowsById.get(rightId);
      return compareWbsCodes(left?.wbsCode ?? "", right?.wbsCode ?? "") || leftId.localeCompare(rightId);
    }));
  }

  return {
    rowsById,
    childIdsByParentId,
    rootIds: childIdsByParentId.get(null) ?? []
  };
}

export function flattenPlanningRows(
  index: PlanningTreeIndex,
  collapsedTaskIds: ReadonlySet<string> = new Set()
): PlanningTreeRow[] {
  const result: PlanningTreeRow[] = [];

  function append(taskIds: readonly string[], depth: number): void {
    for (const taskId of taskIds) {
      const task = index.rowsById.get(taskId);
      if (!task) continue;
      result.push({ id: task.id, depth, wbsCode: task.wbsCode });
      if (!collapsedTaskIds.has(task.id)) {
        append(index.childIdsByParentId.get(task.id) ?? [], depth + 1);
      }
    }
  }

  append(index.rootIds, 0);
  return result;
}

export function computeFallbackWbsCodes(rows: readonly PlanningGanttTaskRow[]): Map<string, string> {
  const index = buildPlanningTreeIndex(rows);
  const wbsCodes = new Map<string, string>();

  function append(taskIds: readonly string[], prefix: string): void {
    taskIds.forEach((taskId, indexInParent) => {
      const wbsCode = prefix ? `${prefix}.${indexInParent + 1}` : String(indexInParent + 1);
      wbsCodes.set(taskId, wbsCode);
      append(index.childIdsByParentId.get(taskId) ?? [], wbsCode);
    });
  }

  append(index.rootIds, "");
  return wbsCodes;
}

function compareWbsCodes(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = parseWbsPart(leftParts[index]);
    const rightPart = parseWbsPart(rightParts[index]);
    if (leftPart !== rightPart) return leftPart - rightPart;
  }

  return 0;
}

function parseWbsPart(part: string | undefined): number {
  if (!part) return 0;
  const numericPart = Number.parseInt(part, 10);
  return Number.isFinite(numericPart) ? numericPart : 0;
}
