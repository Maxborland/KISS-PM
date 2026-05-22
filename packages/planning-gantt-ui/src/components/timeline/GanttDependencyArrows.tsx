import type { PlanningGanttDependencyRow } from "../../types/viewModel";
import type { GanttBarRect } from "./GanttBar";

export function GanttDependencyArrows(props: {
  dependencies: readonly PlanningGanttDependencyRow[];
  rectsByTaskId: ReadonlyMap<string, GanttBarRect>;
}) {
  return (
    <g aria-label="Связи задач">
      {props.dependencies.flatMap((dependency) => {
        const predecessor = props.rectsByTaskId.get(dependency.predecessorTaskId);
        const successor = props.rectsByTaskId.get(dependency.successorTaskId);
        if (!predecessor || !successor) return [];
        const path = dependencyPath(dependency, predecessor, successor);

        return (
          <path
            key={dependency.id}
            className={dependency.valid ? "planningGanttDependency" : "planningGanttDependency planningGanttDependencyInvalid"}
            d={path}
            data-dependency-id={dependency.id}
          />
        );
      })}
    </g>
  );
}

function dependencyPath(
  dependency: PlanningGanttDependencyRow,
  predecessor: GanttBarRect,
  successor: GanttBarRect
): string {
  const predecessorAnchorX = dependency.type === "SS" || dependency.type === "SF"
    ? predecessor.startX
    : predecessor.finishX;
  const successorAnchorX = dependency.type === "FS" || dependency.type === "SS"
    ? successor.startX
    : successor.finishX;
  const predecessorY = predecessor.y + predecessor.height / 2;
  const successorY = successor.y + successor.height / 2;
  const elbowX = predecessorAnchorX + Math.sign(successorAnchorX - predecessorAnchorX || 1) * 12;

  return [
    `M ${predecessorAnchorX} ${predecessorY}`,
    `L ${elbowX} ${predecessorY}`,
    `L ${elbowX} ${successorY}`,
    `L ${successorAnchorX} ${successorY}`
  ].join(" ");
}
