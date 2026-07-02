/** Типы простого Gantt widget. */

/** Строка WBS — задача / стадия / суммарная. */
export type GanttRow = {
  id: string;
  /** Уровень иерархии (0..3). */
  level: 0 | 1 | 2 | 3;
  /** Тип строки: summary (свёрнутая ветка) / task / milestone. */
  kind: "summary" | "task" | "milestone";
  /** Название задачи. */
  name: string;
  /** Код WBS (например 1.2.1). */
  wbs?: string;
  /** День старта от начала окна (0-based). */
  startDay: number;
  /** Длительность в днях. */
  durationDays: number;
  /** Процент выполнения (0..1). */
  progress?: number;
  /** Режим планирования (Авто/Руч.). */
  mode?: string;
  /** Трудоёмкость в минутах. */
  workMinutes?: number | null;
  /** Дата начала (отформатированная). */
  startLabel?: string;
  /** Дата окончания (отформатированная). */
  finishLabel?: string;
  /** Имя назначенного ресурса. */
  resourceName?: string;
  /** Назначение (короткие инициалы). */
  assignee?: { initials: string; color: "c1" | "c2" | "c3" | "c4" | "c5" | "c6" };
  /** Критический путь — рисуем красную рамку. */
  critical?: boolean;
  /** Коды предшественников для колонки «Предш.» (напр. "1.1, 2"). */
  predecessorLabel?: string;
  /** Id задач-предшественников (для рисования стрелок связей). */
  predecessorIds?: string[];
  /** Признак свёрнутой ветки (отображает CaretDown). */
  collapsed?: boolean;
  /** Можно ли разворачивать (есть дети). */
  collapsible?: boolean;
  /** Id родительской строки WBS (для сворачивания потомков). */
  parentId?: string;
};

export type GanttDayHeader = {
  /** ISO-дата (YYYY-MM-DD) — стабильный key, т.к. номер дня повторяется на диапазоне >1 месяца. */
  iso?: string;
  day: number; // 1..31
  weekdayShort: string; // Пн..Вс
  weekend?: boolean;
  today?: boolean;
};

export type GanttData = {
  /** Заголовки дней — длина задаёт ширину timeline. */
  days: GanttDayHeader[];
  /** Подпись месяца (для двухуровневой шапки). */
  monthLabel?: string;
  /** Строки. */
  rows: GanttRow[];
};
