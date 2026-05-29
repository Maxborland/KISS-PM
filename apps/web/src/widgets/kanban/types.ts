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
  /** Опциональный порядок для стабильного manual-режима после DnD. */
  sortOrder?: number;
};

export type KanbanColumnAction = "rename" | "wip" | "add";

/** Ключ сортировки. `manual` — порядок, заданный пользователем через DnD. */
export type KanbanColumnSortKey = "manual" | string;

export type KanbanSortOption = {
  key: KanbanColumnSortKey;
  label: string;
};

export type KanbanColumnSortState<C extends string = string> = Partial<Record<C, KanbanColumnSortKey>>;

export type KanbanCardViewField = {
  id: string;
  label: string;
  defaultOn: boolean;
  /** Поле обязательное и не может быть скрыто через меню. */
  required?: boolean;
};

export type KanbanCardViewProfileId = "task" | "deal";

export type KanbanCardViewProfile = {
  id: KanbanCardViewProfileId;
  label: string;
  fields: KanbanCardViewField[];
};

export type KanbanCardViewState = Record<string, boolean>;

export type KanbanCardRenderContext = {
  draggable: boolean;
  isDragging: boolean;
  visibleFields: ReadonlySet<string>;
};

export type KanbanProps<T extends KanbanItem<C>, C extends string = string> = {
  columns: KanbanColumnDef<C>[];
  items: T[];
  renderCard: (item: T, ctx: KanbanCardRenderContext) => ReactNode;
  renderColumnHeader?: (column: KanbanColumnDef<C>, count: number) => ReactNode;
  renderColumnFooter?: (column: KanbanColumnDef<C>) => ReactNode;
  renderColumnEmpty?: (column: KanbanColumnDef<C>) => ReactNode;
  onItemOpen?: (id: string) => void;
  onItemMove?: (id: string, toColumnId: C, toIndex: number, overId?: string) => void;
  onItemReorder?: (
    columnId: C,
    fromIndex: number,
    toIndex: number,
    movingId?: string,
    overId?: string
  ) => void;
  onColumnAction?: (columnId: C, action: KanbanColumnAction) => void;
  /** Опции сортировки в меню колонки. Включают `manual` или пресеты потребителя. */
  sortOptions?: KanbanSortOption[];
  /** Текущее состояние сортировки по колонкам (контролируется потребителем). */
  columnSort?: KanbanColumnSortState<C>;
  /** Колбэк смены ключа сортировки в одной колонке. */
  onColumnSortChange?: (columnId: C, key: KanbanColumnSortKey) => void;
  /** Видимые поля карточек — потребитель управляет через `KanbanCardViewMenu`. */
  visibleFields?: ReadonlySet<string>;
  disableDnd?: boolean;
  showCount?: boolean;
  /** `funnel` рендерит «коробочные» колонки для CRM-воронки (5 колонок по умолчанию). */
  boardVariant?: KanbanBoardVariant;
  className?: string;
};

export type KanbanDragItemData<C extends string> = {
  type: "item";
  columnId: C;
};

export type KanbanDragColumnData<C extends string> = {
  type: "column";
  columnId: C;
};
