export type GanttBarLayout = {
  taskId: string;
  rowIndex: number;
  left: number;
  width: number;
};

export type GanttDependencyInput = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: string;
};

export type GanttDependencyPath = {
  id: string;
  d: string;
};

const ROW_HEIGHT = 36;

function barAnchor(
  layout: GanttBarLayout,
  edge: "start" | "finish"
): { x: number; y: number } {
  const x = edge === "start" ? layout.left : layout.left + layout.width;
  const y = layout.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
  return { x, y };
}

export function buildDependencyPaths(input: {
  dependencies: GanttDependencyInput[];
  layoutsByTaskId: Map<string, GanttBarLayout>;
}): GanttDependencyPath[] {
  const paths: GanttDependencyPath[] = [];
  for (const dependency of input.dependencies) {
    const predecessor = input.layoutsByTaskId.get(dependency.predecessorTaskId);
    const successor = input.layoutsByTaskId.get(dependency.successorTaskId);
    if (!predecessor || !successor) continue;
    const from = barAnchor(predecessor, dependency.type.startsWith("S") ? "start" : "finish");
    const to = barAnchor(successor, dependency.type.endsWith("S") ? "start" : "finish");
    const midX = from.x + (to.x - from.x) / 2;
    paths.push({
      id: dependency.id,
      d: `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`
    });
  }
  return paths;
}
