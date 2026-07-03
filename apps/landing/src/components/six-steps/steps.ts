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

export const SIX_STEPS: ReadonlyArray<StepDefinition> = [
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
];
