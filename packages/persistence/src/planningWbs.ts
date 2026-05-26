export type WbsTaskRow = {
  id: string;
  parentTaskId: string | null;
  wbsCode: string;
  createdAt: Date;
};

export function reindexTaskRowsByWbs<T extends WbsTaskRow>(
  rows: T[],
  siblingOrderOverrides: Map<string, number> = new Map()
): T[] {
  const taskIds = new Set(rows.map((task) => task.id));
  const inputOrderById = new Map(rows.map((task, index) => [task.id, index]));
  const rowsByParentId = new Map<string | null, T[]>();

  for (const row of rows) {
    const parentId = row.parentTaskId !== null && taskIds.has(row.parentTaskId) ? row.parentTaskId : null;
    const normalizedRow = parentId === row.parentTaskId ? row : { ...row, parentTaskId: null };
    rowsByParentId.set(parentId, [...(rowsByParentId.get(parentId) ?? []), normalizedRow]);
  }

  const result: T[] = [];
  const emittedTaskIds = new Set<string>();

  const appendChildren = (parentId: string | null, prefix: string): void => {
    const siblings = [...(rowsByParentId.get(parentId) ?? [])].sort((left, right) => {
      const leftOverride = siblingOrderOverrides.get(left.id);
      const rightOverride = siblingOrderOverrides.get(right.id);
      if (leftOverride !== undefined || rightOverride !== undefined) {
        return (leftOverride ?? Number.MAX_SAFE_INTEGER) - (rightOverride ?? Number.MAX_SAFE_INTEGER);
      }
      return (
        compareTaskRowsByWbs(left, right) ||
        (inputOrderById.get(left.id) ?? 0) - (inputOrderById.get(right.id) ?? 0)
      );
    });

    siblings.forEach((task, index) => {
      if (emittedTaskIds.has(task.id)) return;
      const wbsCode = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      emittedTaskIds.add(task.id);
      result.push({ ...task, wbsCode });
      appendChildren(task.id, wbsCode);
    });
  };

  appendChildren(null, "");
  return result;
}

export function compareTaskRowsByWbs(
  left: Pick<WbsTaskRow, "wbsCode" | "createdAt" | "id">,
  right: Pick<WbsTaskRow, "wbsCode" | "createdAt" | "id">
): number {
  return (
    compareWbsCodes(left.wbsCode, right.wbsCode) ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

export function compareWbsCodes(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumber = parseWbsPart(leftPart);
    const rightNumber = parseWbsPart(rightPart);
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return leftPart.localeCompare(rightPart, undefined, { numeric: true });
  }

  return 0;
}

export function parseWbsPart(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}
