/**
 * KISS PM Landing — demo state machine.
 *
 * Mirrors the product contour without depending on apps/web internals.
 * Each step exposes the "next allowed action" so the UI can subtly
 * highlight where the user should click. The hints are intentionally
 * minimal to embody the KISS philosophy ("one clear next step").
 */

export type DemoStep =
  | "crm-list"
  | "crm-deal"
  | "intake"
  | "project"
  | "task"
  | "signal"
  | "action"
  | "audit";

export interface DemoState {
  step: DemoStep;
  visited: ReadonlyArray<DemoStep>;
}

export const ORDER: ReadonlyArray<DemoStep> = [
  "crm-list",
  "crm-deal",
  "intake",
  "project",
  "task",
  "signal",
  "action",
  "audit",
];

export interface DemoStepMeta {
  id: DemoStep;
  badge: string;
  title: string;
  hint: string;
}

export const STEP_META: Record<DemoStep, DemoStepMeta> = {
  "crm-list": {
    id: "crm-list",
    badge: "Шаг 1 · Портфель",
    title: "147 проектов в работе",
    hint: "Откройте новый проектный спрос",
  },
  "crm-deal": {
    id: "crm-deal",
    badge: "Шаг 2 · Спрос",
    title: "Новая работа входит в портфель",
    hint: "Запустите оценку ёмкости до обещания сроков",
  },
  intake: {
    id: "intake",
    badge: "Шаг 3 · Ёмкость",
    title: "Роль выходит за безопасную загрузку",
    hint: "Посмотрите, какие проекты создают давление",
  },
  project: {
    id: "project",
    badge: "Шаг 4 · Контекст",
    title: "Затронутые проекты и сроки",
    hint: "Откройте задачу, которая усиливает конфликт",
  },
  task: {
    id: "task",
    badge: "Шаг 5 · Задача",
    title: "Источник напряжения",
    hint: "Сигнал предупреждает о перегрузе — посмотрите его",
  },
  signal: {
    id: "signal",
    badge: "Шаг 6 · Сигнал",
    title: "Перегруз через 3 недели",
    hint: "Сравните доступные сценарии",
  },
  action: {
    id: "action",
    badge: "Шаг 7 · Действие",
    title: "Выбран сценарий",
    hint: "Подтвердите решение — запись пойдёт в аудит",
  },
  audit: {
    id: "audit",
    badge: "Шаг 8 · Аудит",
    title: "След решения · № 4128",
    hint: "Сбросьте поток, чтобы пройти ещё раз",
  },
};

export function initialState(): DemoState {
  return { step: "crm-list", visited: ["crm-list"] };
}

export function next(state: DemoState): DemoState {
  const idx = ORDER.indexOf(state.step);
  const nextIdx = Math.min(idx + 1, ORDER.length - 1);
  const nextStep = ORDER[nextIdx]!;
  return {
    step: nextStep,
    visited: state.visited.includes(nextStep)
      ? state.visited
      : [...state.visited, nextStep],
  };
}

export function goTo(state: DemoState, step: DemoStep): DemoState {
  if (state.step === step) return state;
  return {
    step,
    visited: state.visited.includes(step) ? state.visited : [...state.visited, step],
  };
}

export function reset(): DemoState {
  return initialState();
}
