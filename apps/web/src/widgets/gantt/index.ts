/**
 * Public API for the Gantt widget. Import from `@/widgets/gantt` (this file).
 * `./gantt` re-exports the same surface for Storybook paths that use `from "./gantt"`.
 */
export { GanttView as Gantt } from "./gantt-view";
export { GanttInteractive } from "./gantt-interactive";
export { TaskDetailsDrawer } from "./task-details-drawer";
export { useGanttController, type UseGanttControllerOptions } from "./gantt-state";
export { GANTT_MOCK } from "./mock-data";
export type {
  GanttData,
  GanttDayHeader,
  GanttDependency,
  GanttInteractiveProps,
  GanttPreviewState,
  GanttProps,
  GanttRow,
  GanttToolbarApi,
  GanttZoom
} from "./types";
