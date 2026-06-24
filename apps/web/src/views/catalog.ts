/** Design v3 screen catalog — статические экраны-прототипы без функционального аналога. */

/** Согласованное RU-имя mock-проекта (§1 DESIGN_CONTRACT). */
export const MOCK_PROJECT_CRM = "Внедрение CRM";

export function mockTaskProjectRef(taskCode: string): string {
  return `${taskCode} · ${MOCK_PROJECT_CRM}`;
}

export function mockProjectScreenTitle(suffix: string): string {
  return `${suffix} · ${MOCK_PROJECT_CRM}`;
}

export type ScreenMeta = {
  id: string;
  storyTitle: string;
  pageTitle: string;
  lead: string;
  breadcrumb: { label: string; current?: boolean }[];
  activeNav?: string;
  variant?: "workspace" | "bare";
};

// Экраны 02/03/05/06/07/07b/08/09/12/13/14/15/17/18/19 переведены в функциональные
// surface (CRM / Project Delivery / Workspace / Admin / Auth) и удалены отсюда как дубли.
// Остаются только прототипы без полного функционального аналога.
export const SCREEN_IDS = [
  "00-space-discipline",
  "01-dashboard",
  "04-create-task-modal",
  "10-settings",
  "11-avatar-menu",
  "16-project-kpi",
  "state-empty",
  "state-error",
  "state-forbidden",
  "state-loading"
] as const;

export type ScreenId = (typeof SCREEN_IDS)[number];

export const SCREEN_META: Record<ScreenId, ScreenMeta> = {
  "00-space-discipline": {
    id: "00-space-discipline",
    storyTitle: "00 Дисциплина отступов",
    pageTitle: "Наложение вместо сдвига",
    lead: "Уведомления, баннеры, фильтры не должны сдвигать контент. Только overlay.",
    breadcrumb: [{ label: "Design", current: true }],
    activeNav: "Дашборд"
  },
  "01-dashboard": {
    id: "01-dashboard",
    storyTitle: "01 Дашборд",
    pageTitle: "Добро пожаловать, Камил",
    lead: "Ваш персональный дашборд: 12 задач, 8 сделок, 3 митинга на сегодня.",
    breadcrumb: [{ label: "Дашборд", current: true }],
    activeNav: "Задачи"
  },
  "04-create-task-modal": {
    id: "04-create-task-modal",
    storyTitle: "04 Модалка создания задачи",
    pageTitle: "Новая задача",
    lead: "Модальное создание с stepper и формой.",
    breadcrumb: [{ label: "Задачи", current: true }],
    activeNav: "Задачи"
  },
  "10-settings": {
    id: "10-settings",
    storyTitle: "10 Настройки",
    pageTitle: "Настройки рабочей области",
    lead: "Профиль, уведомления и интеграции.",
    breadcrumb: [{ label: "Настройки", current: true }],
    activeNav: "Настройки"
  },
  "11-avatar-menu": {
    id: "11-avatar-menu",
    storyTitle: "11 Меню аватара",
    pageTitle: "Профиль пользователя",
    lead: "Меню аватара и быстрые действия.",
    breadcrumb: [{ label: "Профиль", current: true }],
    activeNav: "Дашборд"
  },
  "16-project-kpi": {
    id: "16-project-kpi",
    storyTitle: "16 KPI проекта",
    pageTitle: mockProjectScreenTitle("KPI"),
    lead: "Показатели и сигналы управления.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "KPI", current: true }],
    activeNav: "Отчёты"
  },
  "state-empty": {
    id: "state-empty",
    storyTitle: "Состояние · пусто",
    pageTitle: "Нет задач",
    lead: "Создайте первую задачу или импортируйте из CRM.",
    breadcrumb: [],
    variant: "bare"
  },
  "state-error": {
    id: "state-error",
    storyTitle: "Состояние · ошибка",
    pageTitle: "Ошибка загрузки",
    lead: "Не удалось получить данные. Повторите позже.",
    breadcrumb: [],
    variant: "bare"
  },
  "state-forbidden": {
    id: "state-forbidden",
    storyTitle: "Состояние · нет доступа",
    pageTitle: "Нет доступа",
    lead: "Обратитесь к администратору рабочей области.",
    breadcrumb: [],
    variant: "bare"
  },
  "state-loading": {
    id: "state-loading",
    storyTitle: "Состояние · загрузка",
    pageTitle: "Загрузка",
    lead: "Подготавливаем рабочую область…",
    breadcrumb: [],
    variant: "bare"
  }
};
