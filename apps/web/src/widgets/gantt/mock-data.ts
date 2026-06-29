import type { GanttData, GanttDayHeader, GanttRow } from "./types";

const WEEKDAY_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

function buildDays(start = 1, length = 30, todayDay = 7): GanttDayHeader[] {
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

const days = buildDays(1, 30, 7);

const rows: GanttRow[] = [
  {
    id: "p-1",
    level: 0,
    kind: "summary",
    name: "1. Анализ требований",
    wbs: "1",
    startDay: 0,
    durationDays: 8,
    progress: 1,
    collapsible: true
  },
  {
    id: "t-1-1",
    level: 1,
    kind: "task",
    name: "Воркшоп с заказчиком",
    wbs: "1.1",
    startDay: 0,
    durationDays: 2,
    progress: 1,
    assignee: { initials: "ИИ", color: "c1" }
  },
  {
    id: "t-1-2",
    level: 1,
    kind: "task",
    name: "Бизнес-кейсы",
    wbs: "1.2",
    startDay: 1,
    durationDays: 4,
    progress: 1,
    assignee: { initials: "АП", color: "c2" }
  },
  {
    id: "t-1-3",
    level: 1,
    kind: "task",
    name: "Согласование объёма",
    wbs: "1.3",
    startDay: 4,
    durationDays: 4,
    progress: 0.8,
    assignee: { initials: "КБ", color: "c4" }
  },
  {
    id: "m-1",
    level: 0,
    kind: "milestone",
    name: "Объём зафиксирован",
    wbs: "M1",
    startDay: 8,
    durationDays: 0
  },
  {
    id: "p-2",
    level: 0,
    kind: "summary",
    name: "2. Архитектура и дизайн",
    wbs: "2",
    startDay: 8,
    durationDays: 12,
    progress: 0.5,
    collapsible: true,
    critical: true
  },
  {
    id: "t-2-1",
    level: 1,
    kind: "task",
    name: "Дизайн БД",
    wbs: "2.1",
    startDay: 8,
    durationDays: 5,
    progress: 0.7,
    critical: true,
    assignee: { initials: "АП", color: "c2" }
  },
  {
    id: "t-2-2",
    level: 1,
    kind: "task",
    name: "API-контракт",
    wbs: "2.2",
    startDay: 9,
    durationDays: 6,
    progress: 0.6,
    critical: true,
    assignee: { initials: "ВЮ", color: "c3" }
  },
  {
    id: "t-2-3",
    level: 1,
    kind: "task",
    name: "UI-макеты",
    wbs: "2.3",
    startDay: 11,
    durationDays: 8,
    progress: 0.4,
    assignee: { initials: "КБ", color: "c4" }
  },
  {
    id: "t-2-4",
    level: 1,
    kind: "task",
    name: "Прототип ключевых экранов",
    wbs: "2.4",
    startDay: 14,
    durationDays: 6,
    progress: 0.2,
    assignee: { initials: "ЛА", color: "c5" }
  },
  {
    id: "p-3",
    level: 0,
    kind: "summary",
    name: "3. Разработка MVP",
    wbs: "3",
    startDay: 15,
    durationDays: 12,
    progress: 0.15,
    collapsible: true
  },
  {
    id: "t-3-1",
    level: 1,
    kind: "task",
    name: "Каркас бэкенда",
    wbs: "3.1",
    startDay: 15,
    durationDays: 7,
    progress: 0.3,
    assignee: { initials: "ВЮ", color: "c3" }
  },
  {
    id: "t-3-2",
    level: 1,
    kind: "task",
    name: "Каркас фронтенда",
    wbs: "3.2",
    startDay: 17,
    durationDays: 8,
    progress: 0.2,
    assignee: { initials: "БА", color: "c2" }
  },
  {
    id: "t-3-3",
    level: 1,
    kind: "task",
    name: "Интеграция CRM",
    wbs: "3.3",
    startDay: 21,
    durationDays: 6,
    progress: 0,
    assignee: { initials: "АД", color: "c3" }
  },
  {
    id: "m-2",
    level: 0,
    kind: "milestone",
    name: "Демо MVP",
    wbs: "M2",
    startDay: 27,
    durationDays: 0
  }
];

export const GANTT_MOCK: GanttData = {
  days,
  monthLabel: "Май 2026",
  rows
};
