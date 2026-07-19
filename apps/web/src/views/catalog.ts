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
  breadcrumb: { label: string; href?: string; current?: boolean }[];
  activeNav?: string;
  variant?: "workspace" | "bare";
};

// Экраны 02/03/05/06/07/07b/08/09/12/13/14/15/17/18/19 переведены в функциональные
// surface (CRM / Project Delivery / Workspace / Admin / Auth) и удалены отсюда как дубли.
// Остаются только прототипы без полного функционального аналога.
export const SCREEN_IDS = [
  "00-space-discipline",
  "04-create-task-modal",
  "16-project-kpi",
  "state-empty",
  "state-error",
  "state-forbidden",
  "state-loading",
  "comms-channels",
  "comms-thread",
  "comms-composer",
  "comms-notifications",
  "comms-meetings",
  "comms-meeting-detail",
  "call-lobby",
  "call-active",
  "call-screen-share",
  "call-in-chat",
  "call-device-settings",
  "call-reconnecting"
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
  "04-create-task-modal": {
    id: "04-create-task-modal",
    storyTitle: "04 Модалка создания задачи",
    pageTitle: "Новая задача",
    lead: "Модальное создание с stepper и формой.",
    breadcrumb: [{ label: "Задачи", current: true }],
    activeNav: "Задачи"
  },
  "16-project-kpi": {
    id: "16-project-kpi",
    storyTitle: "16 KPI проекта",
    pageTitle: mockProjectScreenTitle("KPI"),
    lead: "Показатели и сигналы управления.",
    breadcrumb: [{ label: "Проекты", href: "/projects" }, { label: MOCK_PROJECT_CRM }, { label: "KPI", current: true }],
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
  },
  "comms-channels": {
    id: "comms-channels",
    storyTitle: "20 Чаты",
    pageTitle: "Чаты",
    lead: "Каналы команды и личные сообщения.",
    breadcrumb: [{ label: "Чаты", current: true }],
    activeNav: "Чаты"
  },
  "comms-thread": {
    id: "comms-thread",
    storyTitle: "21 Тред",
    pageTitle: "Обсуждение задачи",
    lead: "Сообщения по сущности с ответами и реакциями.",
    breadcrumb: [{ label: "Чаты", href: "/communications/chat" }, { label: "Обсуждение", current: true }],
    activeNav: "Чаты"
  },
  "comms-composer": {
    id: "comms-composer",
    storyTitle: "22 Поле сообщения",
    pageTitle: "Новое сообщение",
    lead: "Упоминания, реакции и стикеры в одном поле.",
    breadcrumb: [{ label: "Чаты", href: "/communications/chat" }, { label: "Сообщение", current: true }],
    activeNav: "Чаты"
  },
  "comms-notifications": {
    id: "comms-notifications",
    storyTitle: "23 Уведомления",
    pageTitle: "Уведомления",
    lead: "Упоминания, ответы и приглашения на звонки.",
    breadcrumb: [{ label: "Уведомления", current: true }],
    activeNav: "Уведомления"
  },
  "comms-meetings": {
    id: "comms-meetings",
    storyTitle: "24 Встречи",
    pageTitle: "Встречи",
    lead: "Запланированные и прошедшие встречи команды.",
    breadcrumb: [{ label: "Встречи", current: true }],
    activeNav: "Встречи"
  },
  "comms-meeting-detail": {
    id: "comms-meeting-detail",
    storyTitle: "25 Карточка встречи",
    pageTitle: "Планёрка по внедрению",
    lead: "Повестка, заметки, задачи и внешние ссылки.",
    breadcrumb: [{ label: "Встречи", href: "/communications/meetings" }, { label: "Планёрка", current: true }],
    activeNav: "Встречи"
  },
  "call-lobby": {
    id: "call-lobby",
    storyTitle: "26 Лобби звонка",
    pageTitle: "Подключение к звонку",
    lead: "Проверьте камеру и микрофон перед входом.",
    breadcrumb: [{ label: "Звонки", href: "/communications/calls" }, { label: "Лобби", current: true }],
    activeNav: "Звонки"
  },
  "call-active": {
    id: "call-active",
    storyTitle: "27 Активный звонок",
    pageTitle: "Звонок команды",
    lead: "Сетка участников, демонстрация экрана и запись.",
    breadcrumb: [{ label: "Звонки", href: "/communications/calls" }, { label: "Звонок", current: true }],
    activeNav: "Звонки"
  },
  "call-screen-share": {
    id: "call-screen-share",
    storyTitle: "28 Демонстрация экрана",
    pageTitle: "Демонстрация экрана",
    lead: "Докладчик показывает экран остальным участникам.",
    breadcrumb: [{ label: "Звонки", href: "/communications/calls" }, { label: "Экран", current: true }],
    activeNav: "Звонки"
  },
  "call-in-chat": {
    id: "call-in-chat",
    storyTitle: "29 Чат звонка",
    pageTitle: "Чат во время звонка",
    lead: "Сообщения участников без выхода из звонка.",
    breadcrumb: [{ label: "Звонки", href: "/communications/calls" }, { label: "Чат", current: true }],
    activeNav: "Звонки"
  },
  "call-device-settings": {
    id: "call-device-settings",
    storyTitle: "30 Настройки устройств",
    pageTitle: "Камера и микрофон",
    lead: "Выбор устройств и виртуального фона.",
    breadcrumb: [{ label: "Звонки", href: "/communications/calls" }, { label: "Устройства", current: true }],
    activeNav: "Звонки"
  },
  "call-reconnecting": {
    id: "call-reconnecting",
    storyTitle: "31 Переподключение",
    pageTitle: "Восстанавливаем связь",
    lead: "Соединение потеряно. Пробуем переподключиться…",
    breadcrumb: [{ label: "Звонки", href: "/communications/calls" }, { label: "Связь", current: true }],
    activeNav: "Звонки"
  }
};
