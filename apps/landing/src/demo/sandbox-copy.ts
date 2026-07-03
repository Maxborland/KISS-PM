import type { LandingLocale } from "../lib/landing-i18n";
import type { DemoStep } from "./machine";

export type DemoSandboxNavSection = {
  label: string;
  items: ReadonlyArray<{ label: string; steps: ReadonlyArray<DemoStep> }>;
};

export const DEMO_SANDBOX_COPY: Record<LandingLocale, {
  navLabel: string;
  openMenu: string;
  closeMenu: string;
  closeBackdrop: string;
  portfolioChip: string;
  reset: string;
  search: string;
  searchNotice: string;
  avatar: string;
  scenarioLabel: string;
  scenarioTitle: string;
  progressDone: string;
  draft: string;
  draftNotice: string;
  lockedNotice: (label: string, step: number) => string;
  navSections: ReadonlyArray<DemoSandboxNavSection>;
  dockPrimary: Partial<Record<DemoStep, string>>;
}> = {
  ru: {
    navLabel: "Навигация продукта",
    openMenu: "Открыть меню разделов",
    closeMenu: "Закрыть меню разделов",
    closeBackdrop: "Закрыть меню разделов",
    portfolioChip: "147 проектов в работе",
    reset: "↺ Начать сценарий сначала",
    search: "Поиск: проекты, задачи, сделки, CRM",
    searchNotice: "Поиск работает по всему портфелю — в демо навигацию ведёт сценарий.",
    avatar: "АК",
    scenarioLabel: "Сценарий демо",
    scenarioTitle: "Сценарий · 8 шагов",
    progressDone: "пройдено",
    draft: "Сохранить черновик",
    draftNotice: "Сценарий сохраняется автоматически — можно продолжить с текущего шага.",
    lockedNotice: (label, step) => `Раздел «${label}» откроется на шаге ${step} сценария.`,
    navSections: [
      { label: "Работа", items: [
        { label: "Мои задачи", steps: ["task"] },
        { label: "Проекты", steps: ["project"] },
        { label: "Сделки", steps: ["crm-list", "crm-deal"] },
        { label: "Ресурсы", steps: ["intake"] },
      ] },
      { label: "Аналитика", items: [
        { label: "Дашборд", steps: ["action"] },
        { label: "KPI", steps: ["signal"] },
      ] },
      { label: "Администрирование", items: [{ label: "Аудит", steps: ["audit"] }] },
    ],
    dockPrimary: {
      "crm-list": "Открыть «ГК Север» →",
      "crm-deal": "Проверить ёмкость →",
      intake: "К задаче T-1041 →",
      project: "Открыть задачу →",
      task: "Открыть сигнал →",
      signal: "Перейти к действию →",
      action: "Подтвердить и записать →",
    },
  },
  en: {
    navLabel: "Product navigation",
    openMenu: "Open sections menu",
    closeMenu: "Close sections menu",
    closeBackdrop: "Close sections menu",
    portfolioChip: "147 active projects",
    reset: "↺ Restart scenario",
    search: "Search: projects, tasks, opportunities, CRM",
    searchNotice: "Search works across the whole portfolio. In the demo, navigation follows the scenario.",
    avatar: "AK",
    scenarioLabel: "Demo scenario",
    scenarioTitle: "Scenario · 8 steps",
    progressDone: "complete",
    draft: "Save draft",
    draftNotice: "The scenario is saved automatically. You can continue from the current step.",
    lockedNotice: (label, step) => `The “${label}” section opens at step ${step} of the scenario.`,
    navSections: [
      { label: "Work", items: [
        { label: "My tasks", steps: ["task"] },
        { label: "Projects", steps: ["project"] },
        { label: "Opportunities", steps: ["crm-list", "crm-deal"] },
        { label: "Resources", steps: ["intake"] },
      ] },
      { label: "Analytics", items: [
        { label: "Dashboard", steps: ["action"] },
        { label: "KPI", steps: ["signal"] },
      ] },
      { label: "Admin", items: [{ label: "Audit", steps: ["audit"] }] },
    ],
    dockPrimary: {
      "crm-list": "Open Northstar →",
      "crm-deal": "Check capacity →",
      intake: "Go to task T-1041 →",
      project: "Open task →",
      task: "Open signal →",
      signal: "Go to action →",
      action: "Confirm and write →",
    },
  },
};