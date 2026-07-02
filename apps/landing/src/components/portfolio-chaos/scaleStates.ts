import type { ScaleState } from "./types";

export const SCALE_STATES: ScaleState[] = [
  {
    id: "team",
    projects: 5,
    title: "5 проектов",
    role: "Команда",
  },
  {
    id: "office",
    projects: 35,
    title: "35 проектов",
    role: "Проектный офис",
  },
  {
    id: "holding",
    projects: 120,
    title: "120 проектов",
    role: "Управляющая компания",
  },
];

export const PROCESSING_PILLS = [
  "Приоритеты",
  "Ёмкость",
  "График",
  "Сигналы",
  "Решения",
] as const;
