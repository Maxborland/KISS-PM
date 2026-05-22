import type {
  PlanningGanttCapabilities,
  PlanningGanttFeatures,
  PlanningGanttIntent,
  PlanningGanttViewModel
} from "..";
import { DEFAULT_PLANNING_GANTT_CAPABILITIES } from "../types/capabilities";
import { DEFAULT_PLANNING_GANTT_FEATURES } from "../types/features";
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
  const range = getProjectDateRange(props.viewModel.tasks, props.viewModel.project.plannedStart);

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
            rows={props.viewModel.tasks}
            dependencies={props.viewModel.dependencies}
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
