import type { ReactNode } from "react";

export type KanbanColumnTone = "neutral" | "info" | "success" | "warning" | "danger" | "violet";

export type KanbanBoardVariant = "default" | "funnel";

export type KanbanColumnDef<C extends string = string> = {
  id: C;
  title: ReactNode;
  tone?: KanbanColumnTone;
  emptyLabel?: ReactNode;
};

export type KanbanItem<C extends string = string> = {
  id: string;
  columnId: C;
  sortOrder?: number;
};

export type KanbanCardRenderContext = {
  draggable: boolean;
  isDragging: boolean;
  visibleFields: ReadonlySet<string>;
};

export type KanbanProps<T extends KanbanItem<C>, C extends string = string> = {
  columns: KanbanColumnDef<C>[];
  items: T[];
  renderCard: (item: T, ctx: KanbanCardRenderContext) => ReactNode;
  onItemMove?: (id: string, toColumnId: C, toIndex: number) => void;
  onItemReorder?: (columnId: C, fromIndex: number, toIndex: number) => void;
  visibleFields?: ReadonlySet<string>;
  disableDnd?: boolean;
  showCount?: boolean;
  boardVariant?: KanbanBoardVariant;
  className?: string;
};

export type KanbanDragItemData<C extends string = string> = {
  type: "item";
  columnId: C;
};

export type KanbanDragColumnData<C extends string = string> = {
  type: "column";
  columnId: C;
};
