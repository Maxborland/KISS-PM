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
    description: "Фиксируйте входящие запросы и держите CRM рядом с будущим проектом.",
    demoType: "deal",
  },
  {
    id: "intake",
    number: "02",
    category: "ПРИЁМКА",
    title: "Черновик проекта",
    description: "Собирайте вводные, роли и сроки до обещаний клиенту.",
    demoType: "draft",
  },
  {
    id: "capacity",
    number: "03",
    category: "ЁМКОСТЬ",
    title: "Проверка загрузки",
    description: "Проверяйте ресурсную загрузку до активации проекта.",
    demoType: "capacity",
  },
  {
    id: "plan",
    number: "04",
    category: "ПЛАН",
    title: "Живой график",
    description: "Видите, как изменения влияют на задачи, сроки и Gantt.",
    demoType: "gantt",
  },
  {
    id: "signal",
    number: "05",
    category: "СИГНАЛ",
    title: "Управленческое действие",
    description: "Сигнал ведёт к разрешённому действию, а не к ещё одному отчёту.",
    demoType: "signal",
  },
  {
    id: "closure",
    number: "06",
    category: "ЗАКРЫТИЕ",
    title: "Уроки в шаблон",
    description: "Закрытие проекта улучшает шаблоны для следующих запусков.",
    demoType: "closure",
  },
];
