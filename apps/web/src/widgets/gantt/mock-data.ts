import type { GanttData, GanttDayHeader, GanttDependency, GanttRow } from "./types";

const WEEKDAY_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

function buildDays(start = 1, length = 35, todayDay = 12): GanttDayHeader[] {
  return Array.from({ length }, (_, i) => {
    const day = start + i;
    const dow = (i + 4) % 7;
    return {
      day,
      weekdayShort: WEEKDAY_RU[dow] ?? "",
      weekend: dow === 0 || dow === 6,
      today: day === todayDay
    };
  });
}

const days = buildDays(1, 35, 12);

const rows: GanttRow[] = [
  {
    id: "root",
    level: 0,
    kind: "summary",
    name: "Производственный портал · Релиз 2",
    wbs: "0",
    startDay: 0,
    durationDays: 32,
    progress: 0.38,
    collapsible: true
  },
  {
    id: "p-1",
    level: 1,
    kind: "summary",
    name: "1. Анализ и согласование",
    wbs: "1",
    startDay: 0,
    durationDays: 9,
    progress: 1,
    collapsible: true
  },
  {
    id: "t-1-1",
    level: 2,
    kind: "task",
    name: "Воркшоп с заказчиком",
    wbs: "1.1",
    startDay: 0,
    durationDays: 2,
    progress: 1,
    assignee: { initials: "ИИ", color: "c1" },
    predecessors: "—"
  },
  {
    id: "t-1-2",
    level: 2,
    kind: "task",
    name: "Бизнес-кейсы",
    wbs: "1.2",
    startDay: 2,
    durationDays: 4,
    progress: 1,
    assignee: { initials: "АП", color: "c2" },
    predecessors: "3"
  },
  {
    id: "t-1-3",
    level: 2,
    kind: "task",
    name: "Согласование объёма работ",
    wbs: "1.3",
    startDay: 6,
    durationDays: 3,
    progress: 0.85,
    assignee: { initials: "КБ", color: "c4" },
    predecessors: "5"
  },
  {
    id: "m-1",
    level: 1,
    kind: "milestone",
    name: "Объём работ зафиксирован",
    wbs: "M1",
    startDay: 9,
    durationDays: 0,
    predecessors: "8"
  },
  {
    id: "p-2",
    level: 1,
    kind: "summary",
    name: "2. Архитектура и дизайн",
    wbs: "2",
    startDay: 9,
    durationDays: 13,
    progress: 0.52,
    collapsible: true
  },
  {
    id: "t-2-1",
    level: 2,
    kind: "task",
    name: "Дизайн БД",
    wbs: "2.1",
    startDay: 9,
    durationDays: 5,
    progress: 0.75,
    critical: true,
    assignee: { initials: "АП", color: "c2" },
    predecessors: "M1"
  },
  {
    id: "t-2-2",
    level: 2,
    kind: "task",
    name: "Контракт API",
    wbs: "2.2",
    startDay: 14,
    durationDays: 6,
    progress: 0.55,
    critical: true,
    scheduleState: "at-risk",
    assignee: { initials: "ВЮ", color: "c3" },
    predecessors: "11",
    baselineStartDay: 12,
    baselineDurationDays: 5,
    notes: "Контракт API для MVP."
  },
  {
    id: "t-2-3",
    level: 2,
    kind: "task",
    name: "Макеты интерфейса",
    wbs: "2.3",
    startDay: 11,
    durationDays: 7,
    progress: 0.4,
    assignee: { initials: "КБ", color: "c4" },
    predecessors: "—"
  },
  {
    id: "t-2-4",
    level: 2,
    kind: "task",
    name: "Прототип ключевых экранов",
    wbs: "2.4",
    startDay: 18,
    durationDays: 5,
    progress: 0.15,
    scheduleState: "overdue",
    assignee: { initials: "ЛА", color: "c5" },
    predecessors: "13",
    baselineStartDay: 16,
    baselineDurationDays: 4,
    notes: "Отставание от baseline на 2 дня (демо)."
  },
  {
    id: "p-3",
    level: 1,
    kind: "summary",
    name: "3. Разработка MVP",
    wbs: "3",
    startDay: 16,
    durationDays: 16,
    progress: 0.22,
    collapsible: true
  },
  {
    id: "t-3-1",
    level: 2,
    kind: "task",
    name: "Серверный каркас",
    wbs: "3.1",
    startDay: 16,
    durationDays: 7,
    progress: 0.35,
    assignee: { initials: "ВЮ", color: "c3" },
    predecessors: "11"
  },
  {
    id: "t-3-1-1",
    level: 3,
    kind: "task",
    name: "Миграции и начальные данные",
    wbs: "3.1.1",
    startDay: 17,
    durationDays: 4,
    progress: 0.5,
    assignee: { initials: "БА", color: "c2" },
    predecessors: "17"
  },
  {
    id: "t-3-2",
    level: 2,
    kind: "task",
    name: "Оболочка интерфейса",
    wbs: "3.2",
    startDay: 20,
    durationDays: 8,
    progress: 0.2,
    assignee: { initials: "БА", color: "c2" },
    predecessors: "20"
  },
  {
    id: "t-3-3",
    level: 2,
    kind: "task",
    name: "Интеграция CRM",
    wbs: "3.3",
    startDay: 24,
    durationDays: 6,
    progress: 0,
    scheduleState: "at-risk",
    assignee: { initials: "АД", color: "c3" },
    predecessors: "22"
  },
  {
    id: "m-2",
    level: 1,
    kind: "milestone",
    name: "Демо MVP",
    wbs: "M2",
    startDay: 31,
    durationDays: 0,
    predecessors: "23"
  }
];

const dependencies: GanttDependency[] = [
  { id: "d1", fromId: "t-1-1", toId: "t-1-2", type: "FS" },
  { id: "d2", fromId: "t-1-2", toId: "t-1-3", type: "FS" },
  { id: "d3", fromId: "t-1-3", toId: "m-1", type: "FS" },
  { id: "d4", fromId: "m-1", toId: "t-2-1", type: "FS" },
  { id: "d5", fromId: "t-2-1", toId: "t-2-2", type: "FS" },
  { id: "d6", fromId: "t-2-2", toId: "t-2-4", type: "FS" },
  { id: "d7", fromId: "t-2-1", toId: "t-3-1", type: "FS" },
  { id: "d8", fromId: "t-3-1", toId: "t-3-1-1", type: "FS" },
  { id: "d9", fromId: "t-3-1-1", toId: "t-3-2", type: "FS" },
  { id: "d10", fromId: "t-3-2", toId: "t-3-3", type: "FS" },
  { id: "d11", fromId: "t-3-3", toId: "m-2", type: "FS" }
];

export const GANTT_MOCK: GanttData = {
  days,
  monthLabel: "Май 2026",
  rows,
  dependencies,
  selectedRowId: "t-2-2"
};
