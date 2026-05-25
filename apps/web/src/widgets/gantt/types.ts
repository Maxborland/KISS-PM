/** Типы Gantt widget (design-v3, frontend-only). */

import type { MouseEvent, ReactNode } from "react";

export type GanttZoom = "hour" | "day" | "week" | "month";

export type GanttScheduleState = "on-track" | "at-risk" | "overdue";

export type GanttDependencyType = "FS" | "SS" | "FF" | "SF";

export type GanttDependencyEndpoint = "start" | "finish";

export type GanttDependency = {
  id: string;
  fromId: string;
  toId: string;
  type?: GanttDependencyType;
  /** Lead/lag in days (negative = lead). Frontend-only. */
  lagDays?: number;
};

export type GanttRowKind = "summary" | "task" | "milestone";

export type EffortMode = "auto" | "custom";

export type GanttRow = {
  id: string;
  tenantId?: string;
  projectId?: string;
  stageId?: string | null;
  statusId?: string;
  statusName?: string;
  statusCategory?: "new" | "waiting" | "in_progress" | "review" | "done";
  requesterUserId?: string;
  ownerUserId?: string;
  level: 0 | 1 | 2 | 3;
  kind: GanttRowKind;
  name: string;
  wbs?: string;
  startDay: number;
  durationDays: number;
  progress?: number;
  plannedWork?: number;
  actualWork?: number;
  requiresAcceptance?: boolean;
  workHours?: number;
  hoursPerDay?: number;
  effortMode?: EffortMode;
  planningIssues?: GanttPlanningIssue[];
  assignee?: { initials: string; color: "c1" | "c2" | "c3" | "c4" | "c5" | "c6" };
  critical?: boolean;
  scheduleState?: GanttScheduleState;
  collapsed?: boolean;
  collapsible?: boolean;
  predecessors?: string;
  /** Baseline overlay (demo). */
  baselineStartDay?: number;
  baselineDurationDays?: number;
  notes?: string;
};

export type GanttColumnId =
  | "num"
  | "mode"
  | "wbs"
  | "name"
  | "duration"
  | "progress"
  | "start"
  | "finish"
  | "predecessors"
  | "resource"
  | "work";

export type GanttColumnConfig = {
  id: GanttColumnId;
  width: number;
  visible: boolean;
  order: number;
};

export type GanttDayHeader = {
  day: number;
  weekdayShort: string;
  weekend?: boolean;
  today?: boolean;
};

export type GanttData = {
  days: GanttDayHeader[];
  monthLabel?: string;
  rows: GanttRow[];
  dependencies?: GanttDependency[];
  selectedRowId?: string;
  selectedDependencyId?: string;
};

/** Frontend-only preview/apply bar (без backend). */
export type GanttPreviewState =
  | "idle"
  | "editing-local"
  | "preview-pending"
  | "preview-ready"
  | "applying"
  | "applied"
  | "error"
  | "conflict";

export type GanttInteractionMode = "readonly" | "interactive";

export type GanttCellField =
  | "name"
  | "duration"
  | "progress"
  | "start"
  | "finish"
  | "predecessors"
  | "resource"
  | "work"
  | "notes";

export type GanttPlanningIssueType =
  | "invalid_date"
  | "dependency_conflict"
  | "resource_overload"
  | "schedule_conflict"
  | "backend_pending";

export type GanttPlanningIssue = {
  type: GanttPlanningIssueType;
  message: string;
  field?: GanttCellField;
};

export type GanttEditSession = {
  rowId: string;
  field: GanttCellField;
  draft: string;
  error?: string;
};

export type GanttFocusCell = {
  rowId: string;
  field: GanttCellField;
};

export type GanttCellRange = {
  anchor: GanttFocusCell;
  focus: GanttFocusCell;
};

export type GanttContextTarget =
  | { kind: "row"; rowId: string }
  | { kind: "cell"; rowId: string; field: GanttCellField }
  | { kind: "bar"; rowId: string }
  | { kind: "dependency"; dependencyId: string };

export type GanttContextMenuState = {
  x: number;
  y: number;
  target: GanttContextTarget;
};

export type GanttContextAction =
  | "openTaskDetails"
  | "insertTaskAbove"
  | "insertTaskBelow"
  | "deleteTask"
  | "copyCells"
  | "pasteCells"
  | "clearCells"
  | "shiftTaskRight"
  | "shiftTaskLeft"
  | "outdentTask"
  | "indentTask"
  | "linkTasks"
  | "deleteDependency";

export type GanttRowDragState = {
  rowId: string;
  dropBeforeRowId: string | null;
  invalid: boolean;
};

export type GanttDragKind = "move" | "resize-end" | "resize-start" | "progress" | "milestone-move";

export type GanttDragSession = {
  kind: GanttDragKind;
  rowId: string;
  pointerStartX: number;
  originStartDay: number;
  originDuration: number;
  originProgress: number;
  previewStartDay: number;
  previewDuration: number;
  previewProgress: number;
};

export type GanttLinkSession = {
  fromId: string;
  fromEndpoint: GanttDependencyEndpoint;
  pointerX: number;
  pointerY: number;
  hoverToId?: string;
  hoverToEndpoint?: GanttDependencyEndpoint;
};

export type GanttChangeEvent =
  | { type: "select-row"; rowId: string | undefined }
  | { type: "edit-commit"; rowId: string; field: GanttCellField }
  | { type: "rows-reorder" }
  | { type: "collapse-toggle"; rowId: string }
  | { type: "indent" }
  | { type: "dependency-add"; dependencyId: string }
  | { type: "dependency-update"; dependencyId: string }
  | { type: "dependency-remove"; dependencyId: string }
  | { type: "drag-commit"; rowId: string; kind: GanttDragKind }
  | { type: "cells-copy" }
  | { type: "cells-paste" }
  | { type: "cells-clear" }
  | { type: "row-drag-commit"; rowId: string }
  | { type: "undo" }
  | { type: "redo" };

export type GanttViewFlags = {
  showDependencies: boolean;
  showBaseline: boolean;
  showCriticalPath: boolean;
};

export type GanttControllerState = {
  data: GanttData;
  previewState: GanttPreviewState;
  previewMessage?: string;
  edit: GanttEditSession | null;
  focus: GanttFocusCell | null;
  selection: GanttCellRange | null;
  drag: GanttDragSession | null;
  link: GanttLinkSession | null;
  rowDrag: GanttRowDragState | null;
  contextMenu: GanttContextMenuState | null;
  clipboardBuffer: string | null;
  flags: GanttViewFlags;
  pendingDeleteRowId: string | null;
  schedulingHint?: string;
  detailsDrawerOpen: boolean;
};

export type GanttProps = {
  data: GanttData;
  className?: string;
  zoom?: GanttZoom;
  interactionMode?: GanttInteractionMode;
  previewState?: GanttPreviewState;
  previewMessage?: string;
  showDependencies?: boolean;
  showBaseline?: boolean;
  showCriticalPath?: boolean;
  edit?: GanttEditSession | null;
  focus?: GanttFocusCell | null;
  selection?: GanttCellRange | null;
  rowDrag?: GanttRowDragState | null;
  drag?: GanttDragSession | null;
  link?: GanttLinkSession | null;
  schedulingHint?: string;
  onRowClick?: (rowId: string) => void;
  onBarClick?: (rowId: string) => void;
  onBarDoubleClick?: (rowId: string) => void;
  columnConfig?: GanttColumnConfig[];
  onColumnResize?: (columnId: GanttColumnId, width: number) => void;
  onColumnReorder?: (fromId: GanttColumnId, toId: GanttColumnId) => void;
  onRowHeaderClick?: (rowId: string) => void;
  onCellClick?: (cell: GanttFocusCell, extend: boolean) => void;
  onCellFocus?: (cell: GanttFocusCell) => void;
  onContextMenu?: (event: MouseEvent, target: GanttContextTarget) => void;
  onRowDragStart?: (rowId: string) => void;
  onRowDragOver?: (rowId: string) => void;
  onRowDragEnd?: () => void;
  onAssignResource?: (rowId: string, initials: string | null) => void;
  onStartEdit?: (rowId: string, field: GanttCellField) => void;
  onEditDraft?: (draft: string) => void;
  onCommitEdit?: () => void;
  onCancelEdit?: () => void;
  onToggleCollapse?: (rowId: string) => void;
  onChartPointerDown?: (
    rowId: string,
    kind: GanttDragKind,
    clientX: number,
    rect: DOMRect,
    dayW: number
  ) => void;
  onChartPointerMove?: (clientX: number, clientY: number) => void;
  onChartPointerUp?: () => void;
  onLinkStart?: (
    rowId: string,
    endpoint: GanttDependencyEndpoint,
    clientX: number,
    clientY: number
  ) => void;
  onLinkMove?: (
    clientX: number,
    clientY: number,
    hover?: { rowId: string; endpoint: GanttDependencyEndpoint }
  ) => void;
  onLinkComplete?: (toRowId: string, toEndpoint: GanttDependencyEndpoint) => void;
  onLinkCancel?: () => void;
  onDependencySelect?: (dependencyId: string) => void;
  onKeyNavigate?: (direction: "up" | "down" | "left" | "right") => void;
};

export type GanttInteractiveProps = {
  initialData: GanttData;
  className?: string;
  zoom?: GanttZoom;
  interactionMode?: GanttInteractionMode;
  initialPreviewState?: GanttPreviewState;
  initialFlags?: Partial<GanttViewFlags>;
  /** @deprecated Use showTaskDetailsDrawer */
  showInspector?: boolean;
  showTaskDetailsDrawer?: boolean;
  showApplyBar?: boolean;
  toolbarSlot?: (api: GanttToolbarApi) => ReactNode;
  onChange?: (data: GanttData, event: GanttChangeEvent) => void;
  onOpenTaskCard?: (taskId: string) => void;
};

export type GanttToolbarApi = {
  addTask: () => void;
  deleteTask: () => void;
  indent: () => void;
  outdent: () => void;
  moveUp: () => void;
  moveDown: () => void;
  linkTasks: () => void;
  unlinkTasks: () => void;
  toggleCriticalPath: () => void;
  toggleBaseline: () => void;
  toggleDependencies: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  flags: GanttViewFlags;
  previewState: GanttPreviewState;
  selectedRowId?: string;
  selectedDependencyId?: string;
  rowCount: number;
  linkMode: boolean;
  toggleTaskDetails: () => void;
  taskDetailsOpen: boolean;
};
