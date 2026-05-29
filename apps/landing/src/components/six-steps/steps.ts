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
    description: "Фиксируйте входящие запросы и создавайте сделки в CRM за несколько секунд.",
    demoType: "deal",
  },
  {
    id: "intake",
    number: "02",
    category: "ПРИЁМКА",
    title: "Черновик проекта",
    description: "Собирайте входные данные и формируйте понятный черновик проекта.",
    demoType: "draft",
  },
  {
    id: "capacity",
    number: "03",
    category: "ЁМКОСТЬ",
    title: "Проверка загрузки",
    description: "Оценивайте загрузку команды и ресурсов на выбранные сроки.",
    demoType: "capacity",
  },
  {
    id: "plan",
    number: "04",
    category: "ПЛАН",
    title: "Живой график",
    description: "План перестраивается при изменениях и сразу показывает влияние на сроки.",
    demoType: "gantt",
  },
  {
    id: "signal",
    number: "05",
    category: "СИГНАЛ",
    title: "Управленческое действие",
    description: "Система подсказывает, когда пора вмешаться и что сделать дальше.",
    demoType: "signal",
  },
  {
    id: "closure",
    number: "06",
    category: "ЗАКРЫТИЕ",
    title: "Уроки в шаблон",
    description: "Результаты проекта сохраняются в шаблон и помогают запускать следующие проекты быстрее.",
    demoType: "closure",
  },
];
