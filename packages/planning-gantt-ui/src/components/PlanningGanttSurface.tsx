import type {
  PlanningGanttCapabilities,
  PlanningGanttFeatures,
  PlanningGanttIntent,
  PlanningGanttViewModel
} from "..";
import { DEFAULT_PLANNING_GANTT_CAPABILITIES } from "../types/capabilities";
import { DEFAULT_PLANNING_GANTT_FEATURES } from "../types/features";
import { filterPlanningRowsByCollapsedState } from "../lib/treeRows";
import { getDayWidth, getProjectDateRange, type PlanningGanttScale } from "../lib/timelineScale";
import { GanttLegend } from "./GanttLegend";
import { SplitView } from "./SplitView";
import { GanttTimeline } from "./timeline/GanttTimeline";
import { WbsGrid } from "./wbs/WbsGrid";
import "./planning-gantt.css";

export function PlanningGanttSurface(props: {
  viewModel: PlanningGanttViewModel;
  scale?: PlanningGanttScale;
  features?: Partial<PlanningGanttFeatures>;
  capabilities?: Partial<PlanningGanttCapabilities>;
  collapsedTaskIds?: ReadonlySet<string>;
  selectedTaskId?: string | null;
  onIntent?: (intent: PlanningGanttIntent) => void;
  onSelectTask?: (taskId: string) => void;
}) {
  const features = { ...DEFAULT_PLANNING_GANTT_FEATURES, ...props.features };
  const capabilities = { ...DEFAULT_PLANNING_GANTT_CAPABILITIES, ...props.capabilities };
  const scale = props.scale ?? "day";
  const dayWidth = getDayWidth(scale);
  const visibleRows = props.collapsedTaskIds
    ? filterPlanningRowsByCollapsedState(props.viewModel.tasks, props.collapsedTaskIds)
    : props.viewModel.tasks;
  const visibleTaskIds = new Set(visibleRows.map((row) => row.id));
  const visibleDependencies = props.viewModel.dependencies.filter(
    (dependency) =>
      visibleTaskIds.has(dependency.predecessorTaskId) &&
      visibleTaskIds.has(dependency.successorTaskId)
  );
  const range = getProjectDateRange(visibleRows, props.viewModel.project.plannedStart);

  return (
    <div className="planningGanttSurface" data-plan-version={props.viewModel.planVersion}>
      <GanttLegend />
      <SplitView
        leftLabel="WBS таблица"
        rightLabel="Диаграмма Ганта"
        left={(
          <WbsGrid
            rows={props.viewModel.tasks}
            collapsedTaskIds={props.collapsedTaskIds}
            selectedTaskId={props.selectedTaskId}
            capabilities={capabilities}
            onIntent={props.onIntent}
            onSelectTask={props.onSelectTask}
          />
        )}
        right={(
          <GanttTimeline
            rows={visibleRows}
            dependencies={visibleDependencies}
            rangeStart={range.start}
            rangeFinish={range.finish}
            dayWidth={dayWidth}
            features={features}
          />
        )}
      />
    </div>
  );
}
