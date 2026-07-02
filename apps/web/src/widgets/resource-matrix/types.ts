/** Типы дневной матрицы ресурсов. */

/** Состояние ячейки матрицы за один день. */
export type DayCell =
  | { kind: "weekend" }
  | { kind: "holiday" }
  | { kind: "vacation" }
  | { kind: "zero" }
  | { kind: "load"; hours: number; level: "normal" | "high" | "over" };

/** Один день в шапке: число, выходной/праздник, today. */
export type DayHeader = {
  day: number;
  /** "Wed" | "Sat" | "Sun" — два первых символа русские (Пн, Вт, ...). */
  weekdayShort?: string;
  weekend?: boolean;
  holiday?: boolean;
  today?: boolean;
};

export type MatrixPercent = {
  value: number;
  level: "low" | "mid" | "norm" | "high" | "over";
};

export type MatrixRowKind = "workshop" | "sub" | "role" | "person";

export type AvatarColor = "c1" | "c2" | "c3" | "c4" | "c5" | "c6";

export type MatrixRow = {
  id: string;
  kind: MatrixRowKind;
  /** Уровень вложенности (0 — toplevel; 1 — внутри роли; 2 — внутри подгруппы). */
  indent?: 0 | 1 | 2;
  name: string;
  /** Аватар для person rows. */
  avatar?: { initials: string; color: AvatarColor };
  /** Загрузка % (только roles/persons). */
  percent?: MatrixPercent;
  /** Можно ли свернуть (для group rows). */
  collapsible?: boolean;
  /** Свёрнута ли ветка. */
  collapsed?: boolean;
  /** Id родительской строки (для сворачивания потомков). */
  parentId?: string;
  /** Ячейки за каждый день месяца, длина равна `days.length`. */
  cells: DayCell[];
};

export type ResourceMatrixData = {
  /** Заголовки месяца — массив дней с метаданными. */
  days: DayHeader[];
  rows: MatrixRow[];
  stats: {
    capacityHours: number;
    assignedHours: number;
    loadPct: number;
    freeHours: number;
    employees: number;
  };
};
