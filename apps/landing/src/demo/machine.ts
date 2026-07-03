import type { LandingLocale } from "../lib/landing-i18n";

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

export const STEP_META_BY_LOCALE: Record<LandingLocale, Record<DemoStep, DemoStepMeta>> = {
  ru: {
    "crm-list": {
      id: "crm-list",
      badge: "Шаг 1 · CRM",
      title: "147 проектов в работе",
      hint: "Откройте сделку «ГК Север» в списке",
    },
    "crm-deal": {
      id: "crm-deal",
      badge: "Шаг 2 · Сделка",
      title: "ГК Север · ₽ 8.4 млн",
      hint: "Запустите проверку ёмкости по сделке ГК Север · ₽ 8.4 млн",
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
  },
  en: {
    "crm-list": {
      id: "crm-list",
      badge: "Step 1 · CRM",
      title: "147 active projects",
      hint: "Open the Northstar opportunity in the list",
    },
    "crm-deal": {
      id: "crm-deal",
      badge: "Step 2 · Opportunity",
      title: "Northstar · $120k",
      hint: "Run the capacity check for the Northstar opportunity",
    },
    intake: {
      id: "intake",
      badge: "Step 3 · Capacity",
      title: "A role is above safe load",
      hint: "See which projects create the pressure",
    },
    project: {
      id: "project",
      badge: "Step 4 · Context",
      title: "Affected projects and dates",
      hint: "Open the task that makes the conflict visible",
    },
    task: {
      id: "task",
      badge: "Step 5 · Task",
      title: "Pressure source",
      hint: "The signal warns about overload — open it",
    },
    signal: {
      id: "signal",
      badge: "Step 6 · Signal",
      title: "Overload in 3 weeks",
      hint: "Compare the available scenarios",
    },
    action: {
      id: "action",
      badge: "Step 7 · Action",
      title: "Scenario selected",
      hint: "Confirm the decision — it will be written to audit",
    },
    audit: {
      id: "audit",
      badge: "Step 8 · Audit",
      title: "Decision trail · #4128",
      hint: "Reset the flow to walk through it again",
    },
  },
};

export const STEP_META: Record<DemoStep, DemoStepMeta> = STEP_META_BY_LOCALE.ru;

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