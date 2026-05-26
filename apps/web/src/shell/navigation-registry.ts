import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  FolderKanban,
  LayoutDashboard,
  Settings,
  SquareCheckBig
} from "lucide-react";

import type { SidebarGroup } from "@/shell/sidebar-types";
import type { Crumb } from "@/shell/topbar-breadcrumbs";
import { MOCK_PROJECT_CRM, mockProjectScreenTitle, mockTaskProjectRef } from "@/views/project-mock";
import type { ScreenId } from "@/views/screen-ids";

export const RAIL_SECTIONS = [
  { id: "overview", label: "Обзор", shortLabel: "Обзор", icon: LayoutDashboard },
  { id: "tasks", label: "Задачи", shortLabel: "Задачи", icon: SquareCheckBig },
  { id: "crm", label: "CRM", shortLabel: "CRM", icon: Briefcase },
  { id: "projects", label: "Проекты", shortLabel: "Проекты", icon: FolderKanban },
  { id: "directories", label: "Справочники", shortLabel: "Спр.", icon: BookOpen },
  { id: "reports", label: "Отчёты", shortLabel: "Отчёты", icon: BarChart3 },
  { id: "settings", label: "Настройки", shortLabel: "Настр.", icon: Settings }
] as const;

export type RailSectionId = (typeof RAIL_SECTIONS)[number]["id"];

export type ScreenRouteMeta = {
  id: ScreenId;
  storyTitle: string;
  pageTitle: string;
  lead: string;
  breadcrumb: Crumb[];
  railSection: RailSectionId;
  contextActiveItem: string;
  variant?: "workspace" | "login" | "bare";
  topbarMode?: "minimal" | "team";
  pageIntroActions?: "create-export" | "none";
};

export const CONTEXT_NAV: Record<RailSectionId, SidebarGroup[]> = {
  overview: [
    {
      title: "Обзор",
      items: [
        { label: "Дашборд" },
        { label: "Календарь" },
        { label: "Витрина" }
      ]
    }
  ],
  tasks: [
    {
      title: "Задачи",
      items: [
        { label: "Моя работа" },
        { label: "Бэклог", nested: true, badge: "24" },
        { label: "В работе", nested: true, badge: "4" },
        { label: "Проверка", nested: true, badge: "7" },
        { label: "Готово", nested: true, badge: "13" }
      ]
    }
  ],
  crm: [
    {
      title: "CRM",
      items: [
        { label: "Сделки" },
        { label: "Входящие", badge: "3" },
        { label: "Контакты" }
      ]
    }
  ],
  projects: [
    {
      title: "Проекты",
      items: [
        { label: "Все проекты" },
        { label: "Активные", badge: "14" },
        { label: "На ревью", badge: "3" }
      ]
    },
    {
      title: "Текущий проект",
      items: [
        { label: "Гант", nested: true },
        { label: "Ресурсы", nested: true },
        { label: "Базовый план", nested: true },
        { label: "Сценарии", nested: true },
        { label: "KPI", nested: true },
        { label: "Аудит", nested: true },
        { label: "Календари", nested: true }
      ]
    }
  ],
  directories: [
    {
      title: "Справочники",
      items: [{ label: "Клиенты" }, { label: "Контакты" }, { label: "Продукты" }]
    }
  ],
  reports: [
    {
      title: "Отчёты",
      items: [
        { label: "Сводка портфеля" },
        { label: "Загрузка ресурсов" },
        { label: "KPI арендатора" }
      ]
    }
  ],
  settings: [
    {
      title: "Настройки",
      items: [
        { label: "Рабочая область" },
        { label: "Администрирование" },
        { label: "Интеграции" }
      ]
    }
  ]
};

export function railSectionIcon(id: RailSectionId): LucideIcon {
  return RAIL_SECTIONS.find((s) => s.id === id)?.icon ?? LayoutDashboard;
}

export function contextNavForSection(
  section: RailSectionId,
  activeItem: string
): SidebarGroup[] {
  return CONTEXT_NAV[section].map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      active: item.label === activeItem
    }))
  }));
}

function route(
  meta: Omit<ScreenRouteMeta, "id"> & { id: ScreenId }
): ScreenRouteMeta {
  return meta;
}

export const SCREEN_ROUTE_BY_ID: Record<ScreenId, ScreenRouteMeta> = {
  "00-space-discipline": route({
    id: "00-space-discipline",
    storyTitle: "00 Дисциплина отступов",
    pageTitle: "Наложение вместо сдвига",
    lead: "Уведомления, баннеры, фильтры не должны сдвигать контент. Только наложение поверх.",
    breadcrumb: [{ label: "Витрина", current: true }],
    railSection: "overview",
    contextActiveItem: "Витрина"
  }),
  "01-dashboard": route({
    id: "01-dashboard",
    storyTitle: "01 Дашборд",
    pageTitle: "Добро пожаловать, Камил",
    lead: "Ваш персональный дашборд: 12 задач, 8 сделок, 3 митинга на сегодня.",
    breadcrumb: [{ label: "Дашборд", current: true }],
    railSection: "overview",
    contextActiveItem: "Дашборд",
    topbarMode: "team",
    pageIntroActions: "create-export"
  }),
  "02-my-work": route({
    id: "02-my-work",
    storyTitle: "02 Моя работа",
    pageTitle: "Моя работа",
    lead: "Канбан и список задач в одном рабочем контуре.",
    breadcrumb: [{ label: "Задачи" }, { label: "Моя работа", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа",
    pageIntroActions: "create-export"
  }),
  "03-task-card": route({
    id: "03-task-card",
    storyTitle: "03 Карточка задачи",
    pageTitle: "Согласовать ТЗ",
    lead: mockTaskProjectRef("MDS-39"),
    breadcrumb: [{ label: "Задачи" }, { label: "MDS-39", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа"
  }),
  "04-create-task-modal": route({
    id: "04-create-task-modal",
    storyTitle: "04 Модалка создания задачи",
    pageTitle: "Новая задача",
    lead: "Модальное создание с пошаговым мастером и формой.",
    breadcrumb: [{ label: "Задачи" }, { label: "Новая задача", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа"
  }),
  "05-deals": route({
    id: "05-deals",
    storyTitle: "05 Сделки",
    pageTitle: "Сделки",
    lead: "Воронка продаж и активные возможности.",
    breadcrumb: [{ label: "CRM" }, { label: "Сделки", current: true }],
    railSection: "crm",
    contextActiveItem: "Сделки",
    pageIntroActions: "create-export"
  }),
  "06-deal-card": route({
    id: "06-deal-card",
    storyTitle: "06 Карточка сделки",
    pageTitle: "Сделка «Ромашка»",
    lead: "Активная сделка в воронке «Продажи».",
    breadcrumb: [{ label: "CRM" }, { label: "Сделки" }, { label: "Ромашка", current: true }],
    railSection: "crm",
    contextActiveItem: "Сделки"
  }),
  "07-projects-list": route({
    id: "07-projects-list",
    storyTitle: "07 Список проектов",
    pageTitle: "Проекты",
    lead: "14 активных проектов, 3 на ревью, 2 на финальной стадии.",
    breadcrumb: [{ label: "Проекты", current: true }],
    railSection: "projects",
    contextActiveItem: "Все проекты",
    pageIntroActions: "create-export"
  }),
  "07b-project-detail": route({
    id: "07b-project-detail",
    storyTitle: "07b Карточка проекта",
    pageTitle: MOCK_PROJECT_CRM,
    lead: "PRJ-2026-014 · ООО «Ромашка»",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM, current: true }],
    railSection: "projects",
    contextActiveItem: "Все проекты"
  }),
  "08-entities-clients": route({
    id: "08-entities-clients",
    storyTitle: "08 Справочник клиентов",
    pageTitle: "Клиенты",
    lead: "Справочник клиентов арендатора.",
    breadcrumb: [{ label: "Справочники" }, { label: "Клиенты", current: true }],
    railSection: "directories",
    contextActiveItem: "Клиенты"
  }),
  "08-entities-contacts": route({
    id: "08-entities-contacts",
    storyTitle: "08 Справочник контактов",
    pageTitle: "Контакты",
    lead: "Контактные лица и связи с CRM.",
    breadcrumb: [{ label: "Справочники" }, { label: "Контакты", current: true }],
    railSection: "directories",
    contextActiveItem: "Контакты"
  }),
  "08-entities-products": route({
    id: "08-entities-products",
    storyTitle: "08 Справочник продуктов",
    pageTitle: "Продукты",
    lead: "Каталог продуктов для сделок и проектов.",
    breadcrumb: [{ label: "Справочники" }, { label: "Продукты", current: true }],
    railSection: "directories",
    contextActiveItem: "Продукты"
  }),
  "09-admin": route({
    id: "09-admin",
    storyTitle: "09 Администрирование",
    pageTitle: "Администрирование",
    lead: "Пользователи, роли и политики рабочей области.",
    breadcrumb: [{ label: "Настройки" }, { label: "Администрирование", current: true }],
    railSection: "settings",
    contextActiveItem: "Администрирование"
  }),
  "10-settings": route({
    id: "10-settings",
    storyTitle: "10 Настройки",
    pageTitle: "Настройки рабочей области",
    lead: "Профиль, уведомления и интеграции.",
    breadcrumb: [{ label: "Настройки", current: true }],
    railSection: "settings",
    contextActiveItem: "Рабочая область"
  }),
  "11-avatar-menu": route({
    id: "11-avatar-menu",
    storyTitle: "11 Меню аватара",
    pageTitle: "Профиль пользователя",
    lead: "Меню аватара и быстрые действия.",
    breadcrumb: [{ label: "Профиль", current: true }],
    railSection: "overview",
    contextActiveItem: "Дашборд"
  }),
  "12-project-gantt": route({
    id: "12-project-gantt",
    storyTitle: "12 Гант проекта",
    pageTitle: mockProjectScreenTitle("Гант"),
    lead: "План-факт и WBS проекта.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Гант", current: true }],
    railSection: "projects",
    contextActiveItem: "Гант",
    pageIntroActions: "create-export"
  }),
  "13-project-resources": route({
    id: "13-project-resources",
    storyTitle: "13 Ресурсы проекта",
    pageTitle: mockProjectScreenTitle("Ресурсы"),
    lead: "Матрица загрузки и назначения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Ресурсы", current: true }],
    railSection: "projects",
    contextActiveItem: "Ресурсы"
  }),
  "14-project-baseline": route({
    id: "14-project-baseline",
    storyTitle: "14 Базовый план проекта",
    pageTitle: mockProjectScreenTitle("Базовый план"),
    lead: "Снимки плана и отклонения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Базовый план", current: true }],
    railSection: "projects",
    contextActiveItem: "Базовый план"
  }),
  "15-project-scenarios": route({
    id: "15-project-scenarios",
    storyTitle: "15 Сценарии проекта",
    pageTitle: mockProjectScreenTitle("Сценарии"),
    lead: "Сценарии «что если» и сравнение вариантов.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Сценарии", current: true }],
    railSection: "projects",
    contextActiveItem: "Сценарии"
  }),
  "16-project-kpi": route({
    id: "16-project-kpi",
    storyTitle: "16 KPI проекта",
    pageTitle: mockProjectScreenTitle("KPI"),
    lead: "Показатели и сигналы управления.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "KPI", current: true }],
    railSection: "projects",
    contextActiveItem: "KPI"
  }),
  "17-project-audit": route({
    id: "17-project-audit",
    storyTitle: "17 Аудит проекта",
    pageTitle: mockProjectScreenTitle("Аудит"),
    lead: "Журнал управленческих действий.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Аудит", current: true }],
    railSection: "projects",
    contextActiveItem: "Аудит"
  }),
  "18-project-calendars": route({
    id: "18-project-calendars",
    storyTitle: "18 Календари проекта",
    pageTitle: mockProjectScreenTitle("Календари"),
    lead: "Рабочие календари и исключения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Календари", current: true }],
    railSection: "projects",
    contextActiveItem: "Календари"
  }),
  "19-login": route({
    id: "19-login",
    storyTitle: "19 Вход",
    pageTitle: "Войти в KISS PM",
    lead: "Используйте корпоративный email арендатора.",
    breadcrumb: [],
    railSection: "overview",
    contextActiveItem: "Дашборд",
    variant: "login"
  }),
  "state-empty": route({
    id: "state-empty",
    storyTitle: "Состояние · пусто",
    pageTitle: "Нет задач",
    lead: "Создайте первую задачу или импортируйте из CRM.",
    breadcrumb: [{ label: "Задачи" }, { label: "Моя работа", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа"
  }),
  "state-error": route({
    id: "state-error",
    storyTitle: "Состояние · ошибка",
    pageTitle: "Ошибка загрузки",
    lead: "Не удалось получить данные. Повторите позже.",
    breadcrumb: [{ label: "Задачи" }, { label: "Моя работа", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа"
  }),
  "state-forbidden": route({
    id: "state-forbidden",
    storyTitle: "Состояние · нет доступа",
    pageTitle: "Нет доступа",
    lead: "Обратитесь к администратору рабочей области.",
    breadcrumb: [{ label: "Задачи" }, { label: "Моя работа", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа"
  }),
  "state-loading": route({
    id: "state-loading",
    storyTitle: "Состояние · загрузка",
    pageTitle: "Загрузка",
    lead: "Подготавливаем рабочую область…",
    breadcrumb: [{ label: "Задачи" }, { label: "Моя работа", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа"
  })
};

export function getScreenRoute(id: ScreenId): ScreenRouteMeta {
  return SCREEN_ROUTE_BY_ID[id];
}
