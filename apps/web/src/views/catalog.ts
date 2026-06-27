/** Design v2 screen / pattern ids (parity with docs/design-v2) */

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
  variant?: "workspace" | "login" | "bare";
};

export type PatternMeta = {
  id: string;
  storyTitle: string;
};

export const SCREEN_IDS = [
  "00-space-discipline",
  "01-dashboard",
  "02-my-work",
  "03-task-card",
  "04-create-task-modal",
  "05-deals",
  "06-deal-card",
  "07-projects-list",
  "07b-project-detail",
  "08-entities-clients",
  "08-entities-contacts",
  "08-entities-products",
  "09-admin",
  "10-settings",
  "11-avatar-menu",
  "12-project-gantt",
  "13-project-resources",
  "14-project-baseline",
  "15-project-scenarios",
  "16-project-kpi",
  "17-project-audit",
  "18-project-calendars",
  "19-login",
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

export const PATTERN_IDS = [
  "shell",
  "page-header",
  "entity-two-column",
  "list-kanban-switcher",
  "settings-tabs",
  "avatar-menu",
  "create-modal"
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];

export const SCREEN_META: Record<ScreenId, ScreenMeta> = {
  "00-space-discipline": {
    id: "00-space-discipline",
    storyTitle: "00 Дисциплина отступов",
    pageTitle: "Overlay вместо push",
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
  "02-my-work": {
    id: "02-my-work",
    storyTitle: "02 Моя работа",
    pageTitle: "Моя работа",
    lead: "Канбан и список задач в одном рабочем контуре.",
    breadcrumb: [{ label: "Задачи", current: true }],
    activeNav: "Задачи"
  },
  "03-task-card": {
    id: "03-task-card",
    storyTitle: "03 Карточка задачи",
    pageTitle: "Согласовать ТЗ",
    lead: mockTaskProjectRef("MDS-39"),
    breadcrumb: [{ label: "Задачи" }, { label: "MDS-39", current: true }],
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
  "05-deals": {
    id: "05-deals",
    storyTitle: "05 Сделки",
    pageTitle: "Сделки",
    lead: "Воронка продаж и активные возможности.",
    breadcrumb: [{ label: "CRM" }, { label: "Сделки", current: true }],
    activeNav: "Входящие"
  },
  "06-deal-card": {
    id: "06-deal-card",
    storyTitle: "06 Карточка сделки",
    pageTitle: "Сделка «Ромашка»",
    lead: "Активная сделка в воронке «Продажи».",
    breadcrumb: [{ label: "Сделки" }, { label: "Ромашка", current: true }],
    activeNav: "Входящие"
  },
  "07-projects-list": {
    id: "07-projects-list",
    storyTitle: "07 Список проектов",
    pageTitle: "Проекты",
    lead: "14 активных проектов, 3 на ревью, 2 на финальной стадии.",
    breadcrumb: [{ label: "Проекты", current: true }],
    activeNav: "Отчёты"
  },
  "07b-project-detail": {
    id: "07b-project-detail",
    storyTitle: "07b Карточка проекта",
    pageTitle: MOCK_PROJECT_CRM,
    lead: "PRJ-2026-014 · ООО «Ромашка»",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM, current: true }],
    activeNav: "Отчёты"
  },
  "08-entities-clients": {
    id: "08-entities-clients",
    storyTitle: "08 Справочник клиентов",
    pageTitle: "Клиенты",
    lead: "Справочник клиентов tenant.",
    breadcrumb: [{ label: "Справочники" }, { label: "Клиенты", current: true }],
    activeNav: "Интеграции"
  },
  "08-entities-contacts": {
    id: "08-entities-contacts",
    storyTitle: "08 Справочник контактов",
    pageTitle: "Контакты",
    lead: "Контактные лица и связи с CRM.",
    breadcrumb: [{ label: "Справочники" }, { label: "Контакты", current: true }],
    activeNav: "Интеграции"
  },
  "08-entities-products": {
    id: "08-entities-products",
    storyTitle: "08 Справочник продуктов",
    pageTitle: "Продукты",
    lead: "Каталог продуктов для сделок и проектов.",
    breadcrumb: [{ label: "Справочники" }, { label: "Продукты", current: true }],
    activeNav: "Интеграции"
  },
  "09-admin": {
    id: "09-admin",
    storyTitle: "09 Администрирование",
    pageTitle: "Администрирование",
    lead: "Пользователи, роли и политики рабочей области.",
    breadcrumb: [{ label: "Настройки" }, { label: "Админ", current: true }],
    activeNav: "Настройки"
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
  "12-project-gantt": {
    id: "12-project-gantt",
    storyTitle: "12 Гант проекта",
    pageTitle: mockProjectScreenTitle("Гант"),
    lead: "План-факт и WBS проекта.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Гант", current: true }],
    activeNav: "Отчёты"
  },
  "13-project-resources": {
    id: "13-project-resources",
    storyTitle: "13 Ресурсы проекта",
    pageTitle: mockProjectScreenTitle("Ресурсы"),
    lead: "Матрица загрузки и назначения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Ресурсы", current: true }],
    activeNav: "Отчёты"
  },
  "14-project-baseline": {
    id: "14-project-baseline",
    storyTitle: "14 Базовый план проекта",
    pageTitle: mockProjectScreenTitle("Базовый план"),
    lead: "Снимки плана и отклонения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Базовый план", current: true }],
    activeNav: "Отчёты"
  },
  "15-project-scenarios": {
    id: "15-project-scenarios",
    storyTitle: "15 Сценарии проекта",
    pageTitle: mockProjectScreenTitle("Сценарии"),
    lead: "Сценарии «что если» и сравнение вариантов.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Сценарии", current: true }],
    activeNav: "Отчёты"
  },
  "16-project-kpi": {
    id: "16-project-kpi",
    storyTitle: "16 KPI проекта",
    pageTitle: mockProjectScreenTitle("KPI"),
    lead: "Показатели и сигналы управления.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "KPI", current: true }],
    activeNav: "Отчёты"
  },
  "17-project-audit": {
    id: "17-project-audit",
    storyTitle: "17 Аудит проекта",
    pageTitle: mockProjectScreenTitle("Аудит"),
    lead: "Журнал управленческих действий.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Аудит", current: true }],
    activeNav: "Отчёты"
  },
  "18-project-calendars": {
    id: "18-project-calendars",
    storyTitle: "18 Календари проекта",
    pageTitle: mockProjectScreenTitle("Календари"),
    lead: "Рабочие календари и исключения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Календари", current: true }],
    activeNav: "Календарь"
  },
  "19-login": {
    id: "19-login",
    storyTitle: "19 Вход",
    pageTitle: "Войти в KISS PM",
    lead: "Используйте корпоративный email tenant.",
    breadcrumb: [],
    variant: "login"
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
    breadcrumb: [{ label: "Чаты" }, { label: "Обсуждение", current: true }],
    activeNav: "Чаты"
  },
  "comms-composer": {
    id: "comms-composer",
    storyTitle: "22 Поле сообщения",
    pageTitle: "Новое сообщение",
    lead: "Упоминания, реакции и стикеры в одном поле.",
    breadcrumb: [{ label: "Чаты" }, { label: "Сообщение", current: true }],
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
    breadcrumb: [{ label: "Встречи" }, { label: "Планёрка", current: true }],
    activeNav: "Встречи"
  },
  "call-lobby": {
    id: "call-lobby",
    storyTitle: "26 Лобби звонка",
    pageTitle: "Подключение к звонку",
    lead: "Проверьте камеру и микрофон перед входом.",
    breadcrumb: [{ label: "Звонки" }, { label: "Лобби", current: true }],
    activeNav: "Звонки"
  },
  "call-active": {
    id: "call-active",
    storyTitle: "27 Активный звонок",
    pageTitle: "Звонок команды",
    lead: "Сетка участников, демонстрация экрана и запись.",
    breadcrumb: [{ label: "Звонки" }, { label: "Звонок", current: true }],
    activeNav: "Звонки"
  },
  "call-screen-share": {
    id: "call-screen-share",
    storyTitle: "28 Демонстрация экрана",
    pageTitle: "Демонстрация экрана",
    lead: "Докладчик показывает экран остальным участникам.",
    breadcrumb: [{ label: "Звонки" }, { label: "Экран", current: true }],
    activeNav: "Звонки"
  },
  "call-in-chat": {
    id: "call-in-chat",
    storyTitle: "29 Чат звонка",
    pageTitle: "Чат во время звонка",
    lead: "Сообщения участников без выхода из звонка.",
    breadcrumb: [{ label: "Звонки" }, { label: "Чат", current: true }],
    activeNav: "Звонки"
  },
  "call-device-settings": {
    id: "call-device-settings",
    storyTitle: "30 Настройки устройств",
    pageTitle: "Камера и микрофон",
    lead: "Выбор устройств и виртуального фона.",
    breadcrumb: [{ label: "Звонки" }, { label: "Устройства", current: true }],
    activeNav: "Звонки"
  },
  "call-reconnecting": {
    id: "call-reconnecting",
    storyTitle: "31 Переподключение",
    pageTitle: "Восстанавливаем связь",
    lead: "Соединение потеряно. Пробуем переподключиться…",
    breadcrumb: [{ label: "Звонки" }, { label: "Связь", current: true }],
    activeNav: "Звонки"
  }
};

export const PATTERN_META: Record<PatternId, PatternMeta> = {
  shell: { id: "shell", storyTitle: "Shell" },
  "page-header": { id: "page-header", storyTitle: "Page header" },
  "entity-two-column": { id: "entity-two-column", storyTitle: "Entity two column" },
  "list-kanban-switcher": { id: "list-kanban-switcher", storyTitle: "List kanban switcher" },
  "settings-tabs": { id: "settings-tabs", storyTitle: "Settings tabs" },
  "avatar-menu": { id: "avatar-menu", storyTitle: "Avatar menu" },
  "create-modal": { id: "create-modal", storyTitle: "Create modal" }
};
