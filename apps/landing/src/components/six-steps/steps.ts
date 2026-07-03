import type { LandingLocale } from "../../lib/landing-i18n";

export type DemoType =
  | "deal"
  | "draft"
  | "capacity"
  | "gantt"
  | "signal"
  | "closure";

export interface StepDefinition {
  id: string;
  number: string;
  category: string;
  title: string;
  description: string;
  demoType: DemoType;
}

export const SIX_STEPS_BY_LOCALE: Record<LandingLocale, ReadonlyArray<StepDefinition>> = {
  ru: [
    {
      id: "crm",
      number: "01",
      category: "CRM",
      title: "Новая сделка",
      description: "Сохраняйте входящий запрос там, где он сразу может стать проектом.",
      demoType: "deal",
    },
    {
      id: "intake",
      number: "02",
      category: "ПРИЁМКА",
      title: "Черновик проекта",
      description: "Превращайте вводные в черновик с ролями, сроками и ограничениями.",
      demoType: "draft",
    },
    {
      id: "capacity",
      number: "03",
      category: "ЁМКОСТЬ",
      title: "Проверка загрузки",
      description: "Проверяйте загрузку команды до того, как обещать сроки.",
      demoType: "capacity",
    },
    {
      id: "plan",
      number: "04",
      category: "ПЛАН",
      title: "Живой график",
      description: "Видите, какие задачи, сроки и зависимости изменит новый план.",
      demoType: "gantt",
    },
    {
      id: "signal",
      number: "05",
      category: "СИГНАЛ",
      title: "Управленческое действие",
      description: "Агент предлагает действие, которое можно проверить и применить.",
      demoType: "signal",
    },
    {
      id: "closure",
      number: "06",
      category: "ЗАКРЫТИЕ",
      title: "Уроки в шаблон",
      description: "Решения и итоги остаются в аудите и улучшают следующие шаблоны.",
      demoType: "closure",
    },
  ],
  en: [
    {
      id: "crm",
      number: "01",
      category: "CRM",
      title: "New opportunity",
      description: "Capture the request where it can become a project, not a loose note.",
      demoType: "deal",
    },
    {
      id: "intake",
      number: "02",
      category: "INTAKE",
      title: "Project draft",
      description: "Turn inputs into a draft with roles, dates and constraints already visible.",
      demoType: "draft",
    },
    {
      id: "capacity",
      number: "03",
      category: "CAPACITY",
      title: "Load check",
      description: "Check team load before promising delivery dates.",
      demoType: "capacity",
    },
    {
      id: "plan",
      number: "04",
      category: "PLAN",
      title: "Living schedule",
      description: "See which tasks, dates and dependencies the new plan changes.",
      demoType: "gantt",
    },
    {
      id: "signal",
      number: "05",
      category: "SIGNAL",
      title: "Management action",
      description: "The agent suggests an action that can be reviewed and applied.",
      demoType: "signal",
    },
    {
      id: "closure",
      number: "06",
      category: "CLOSURE",
      title: "Lessons into template",
      description: "Decisions and outcomes stay in audit and improve the next templates.",
      demoType: "closure",
    },
  ],
};

export const SIX_STEPS: ReadonlyArray<StepDefinition> = SIX_STEPS_BY_LOCALE.ru;