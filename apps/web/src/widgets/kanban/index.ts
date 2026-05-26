export type {
  KanbanBoardVariant,
  KanbanCardRenderContext,
  KanbanCardViewField,
  KanbanCardViewProfile,
  KanbanCardViewProfileId,
  KanbanCardViewState,
  KanbanColumnAction,
  KanbanColumnDef,
  KanbanColumnSortKey,
  KanbanColumnSortState,
  KanbanColumnTone,
  KanbanDragColumnData,
  KanbanDragItemData,
  KanbanItem,
  KanbanProps,
  KanbanSortOption
} from "@/widgets/kanban/types";

export { Kanban } from "@/widgets/kanban/kanban";
export { KanbanWidgetDemo } from "@/widgets/kanban/kanban-widget-demo";
export { TaskKanbanCard, type TaskKanbanCardProps, type TaskKanbanItem } from "@/widgets/kanban/task-kanban-card";
export {
  DealKanbanCard,
  type DealKanbanCardProps,
  type DealKanbanItem,
  type DealKanbanOwner
} from "@/widgets/kanban/deal-kanban-card";

export {
  KanbanCardViewMenu,
  resolveVisibleFields,
  type KanbanCardViewMenuProps
} from "@/widgets/kanban/kanban-card-view-menu";

export {
  sortKanbanColumnItems,
  type KanbanComparators,
  type KanbanItemComparator
} from "@/widgets/kanban/kanban-column-sort";

export { useKanbanOrderedItems } from "@/widgets/kanban/use-kanban-ordered-items";

export {
  TASK_KANBAN_FIELD,
  TASK_KANBAN_SORT_OPTIONS,
  TASK_KANBAN_VIEW_PROFILE,
  buildTaskKanbanComparators,
  defaultTaskKanbanViewState,
  type TaskKanbanFieldId
} from "@/widgets/kanban/task-kanban-profiles";

export {
  DEAL_KANBAN_FIELD,
  DEAL_KANBAN_SORT_OPTIONS,
  DEAL_KANBAN_VIEW_PROFILE,
  buildDealKanbanComparators,
  defaultDealKanbanViewState,
  parseDealAmount,
  type DealKanbanFieldId
} from "@/widgets/kanban/deal-kanban-profiles";

export { ALL_DEAL_KANBAN_FIELDS, dealToKanbanItem } from "@/widgets/kanban/deal-kanban-map";
