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
  { id: "overview", label: "Обзор", shortLabel: "Обзор", icon: LayoutDashboard, href: "/dashboard" },
  { id: "tasks", label: "Задачи", shortLabel: "Задачи", icon: SquareCheckBig, href: "/my-work" },
  { id: "crm", label: "CRM", shortLabel: "CRM", icon: Briefcase, href: "/deals" },
  { id: "projects", label: "Проекты", shortLabel: "Проекты", icon: FolderKanban, href: "/projects" },
  { id: "directories", label: "Справочники", shortLabel: "Спр.", icon: BookOpen, href: "/directories/clients" },
  { id: "reports", label: "Отчёты", shortLabel: "Отчёты", icon: BarChart3, href: "/reports" },
  { id: "settings", label: "Настройки", shortLabel: "Настр.", icon: Settings, href: "/settings" }
] as const;

export type RailSectionId = (typeof RAIL_SECTIONS)[number]["id"];

export const CURRENT_BETA_RUNTIME_SCREEN_IDS = [
  "01-dashboard",
  "20-agent-cockpit",
  "02-my-work",
  "05-deals",
  "07-projects-list",
  "07b-project-detail",
  "09-admin",
  "12-project-gantt",
  "13-project-resources",
  "17-project-audit"
] as const satisfies readonly ScreenId[];

const CURRENT_BETA_RUNTIME_SCREEN_ID_SET = new Set<ScreenId>(CURRENT_BETA_RUNTIME_SCREEN_IDS);

export function isCurrentBetaRuntimeScreen(screenId: ScreenId): boolean {
  return CURRENT_BETA_RUNTIME_SCREEN_ID_SET.has(screenId);
}

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
  path?: string;
  requiredPermissions?: readonly string[];
  requiredPermissionMode?: "any" | "all";
};

export const CONTEXT_NAV: Record<RailSectionId, SidebarGroup[]> = {
  overview: [
    {
      title: "Обзор",
      items: [
        { label: "Дашборд", href: "/dashboard" },
        { label: "Агент", href: "/agent" },
        { label: "Календарь" },
        { label: "Витрина", href: "/showcase/spacing" }
      ]
    }
  ],
  tasks: [
    {
      title: "Задачи",
      items: [
        { label: "Моя работа", href: "/my-work" },
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
        { label: "Сделки", href: "/deals" },
        { label: "Входящие", badge: "3" },
        { label: "Контакты", href: "/directories/contacts" }
      ]
    }
  ],
  projects: [
    {
      title: "Проекты",
      items: [
        { label: "Все проекты", href: "/projects" },
        { label: "Активные", badge: "14" },
        { label: "На ревью", badge: "3" }
      ]
    },
    {
      title: "Текущий проект",
      items: [
        { label: "Гант", nested: true },
        { label: "Ресурсы", nested: true, href: "/projects/demo/resources" },
        { label: "Базовый план", nested: true, href: "/projects/demo/baseline" },
        { label: "Сценарии", nested: true, href: "/projects/demo/scenarios" },
        { label: "KPI", nested: true, href: "/projects/demo/kpi" },
        { label: "Аудит", nested: true, href: "/projects/demo/audit" },
        { label: "Календари", nested: true, href: "/projects/demo/calendars" }
      ]
    }
  ],
  directories: [
    {
      title: "Справочники",
      items: [
        { label: "Клиенты", href: "/directories/clients" },
        { label: "Контакты", href: "/directories/contacts" },
        { label: "Продукты", href: "/directories/products" }
      ]
    }
  ],
  reports: [
    {
      title: "Отчёты",
      items: [
        { label: "Сводка портфеля", href: "/dashboard" },
        { label: "Загрузка ресурсов", href: "/projects/demo/resources" },
        { label: "KPI арендатора", href: "/projects/demo/kpi" }
      ]
    }
  ],
  settings: [
    {
      title: "Настройки",
      items: [
        { label: "Рабочая область", href: "/settings" },
        { label: "Пользователи", href: "/admin/users" },
        { label: "Аудит", href: "/admin/audit" },
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
  activeItem: string,
  permissions?: readonly string[]
): SidebarGroup[] {
  return CONTEXT_NAV[section]
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.href || canOpenRuntimePath(item.href, permissions))
        .map((item) => ({
          ...item,
          active: item.label === activeItem
        }))
    }))
    .filter((group) => group.items.length > 0);
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
    contextActiveItem: "Витрина",
    path: "/showcase/spacing"
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
    pageIntroActions: "create-export",
    path: "/dashboard",
    requiredPermissions: ["tenant.projects.read"]
  }),
  "20-agent-cockpit": route({
    id: "20-agent-cockpit",
    storyTitle: "20 Агент рабочей области",
    pageTitle: "Агент рабочей области",
    lead: "Единый управленческий cockpit для вопросов по портфелю, сверки предложений и подтверждения действий.",
    breadcrumb: [{ label: "Обзор" }, { label: "Агент", current: true }],
    railSection: "overview",
    contextActiveItem: "Агент",
    topbarMode: "minimal",
    path: "/agent",
    requiredPermissions: ["tenant.projects.read"]
  }),
  "02-my-work": route({
    id: "02-my-work",
    storyTitle: "02 Моя работа",
    pageTitle: "Моя работа",
    lead: "Канбан и список задач в одном рабочем контуре.",
    breadcrumb: [{ label: "Задачи" }, { label: "Моя работа", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа",
    pageIntroActions: "create-export",
    path: "/my-work",
    requiredPermissions: ["tenant.projects.read"]
  }),
  "03-task-card": route({
    id: "03-task-card",
    storyTitle: "03 Карточка задачи",
    pageTitle: "Согласовать ТЗ",
    lead: mockTaskProjectRef("MDS-39"),
    breadcrumb: [{ label: "Задачи" }, { label: "MDS-39", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа",
    path: "/tasks/demo/MDS-39"
  }),
  "04-create-task-modal": route({
    id: "04-create-task-modal",
    storyTitle: "04 Модалка создания задачи",
    pageTitle: "Новая задача",
    lead: "Модальное создание с пошаговым мастером и формой.",
    breadcrumb: [{ label: "Задачи" }, { label: "Новая задача", current: true }],
    railSection: "tasks",
    contextActiveItem: "Моя работа",
    path: "/tasks/new"
  }),
  "05-deals": route({
    id: "05-deals",
    storyTitle: "05 Сделки",
    pageTitle: "Сделки",
    lead: "Воронка продаж и активные возможности.",
    breadcrumb: [{ label: "CRM" }, { label: "Сделки", current: true }],
    railSection: "crm",
    contextActiveItem: "Сделки",
    pageIntroActions: "create-export",
    path: "/deals",
    requiredPermissions: ["tenant.opportunities.read", "tenant.deal_stages.read"],
    requiredPermissionMode: "all"
  }),
  "06-deal-card": route({
    id: "06-deal-card",
    storyTitle: "06 Карточка сделки",
    pageTitle: "Сделка «Ромашка»",
    lead: "Активная сделка в воронке «Продажи».",
    breadcrumb: [{ label: "CRM" }, { label: "Сделки" }, { label: "Ромашка", current: true }],
    railSection: "crm",
    contextActiveItem: "Сделки",
    path: "/deals/demo/DEAL-101",
    requiredPermissions: ["tenant.opportunities.read", "tenant.deal_stages.read"],
    requiredPermissionMode: "all"
  }),
  "07-projects-list": route({
    id: "07-projects-list",
    storyTitle: "07 Список проектов",
    pageTitle: "Проекты",
    lead: "14 активных проектов, 3 на ревью, 2 на финальной стадии.",
    breadcrumb: [{ label: "Проекты", current: true }],
    railSection: "projects",
    contextActiveItem: "Все проекты",
    pageIntroActions: "create-export",
    path: "/projects",
    requiredPermissions: ["tenant.projects.read"]
  }),
  "07b-project-detail": route({
    id: "07b-project-detail",
    storyTitle: "07b Карточка проекта",
    pageTitle: "Проект",
    lead: "Живая карточка проекта: сроки, статус, задачи и ответственные.",
    breadcrumb: [{ label: "Проекты" }, { label: "Карточка проекта", current: true }],
    railSection: "projects",
    contextActiveItem: "Все проекты",
    path: "/projects/:projectId",
    requiredPermissions: ["tenant.projects.read"]
  }),
  "08-entities-clients": route({
    id: "08-entities-clients",
    storyTitle: "08 Справочник клиентов",
    pageTitle: "Клиенты",
    lead: "Справочник клиентов арендатора.",
    breadcrumb: [{ label: "Справочники" }, { label: "Клиенты", current: true }],
    railSection: "directories",
    contextActiveItem: "Клиенты",
    path: "/directories/clients",
    requiredPermissions: ["tenant.clients.read"]
  }),
  "08-entities-contacts": route({
    id: "08-entities-contacts",
    storyTitle: "08 Справочник контактов",
    pageTitle: "Контакты",
    lead: "Контактные лица и связи с CRM.",
    breadcrumb: [{ label: "Справочники" }, { label: "Контакты", current: true }],
    railSection: "directories",
    contextActiveItem: "Контакты",
    path: "/directories/contacts",
    requiredPermissions: ["tenant.contacts.read"]
  }),
  "08-entities-products": route({
    id: "08-entities-products",
    storyTitle: "08 Справочник продуктов",
    pageTitle: "Продукты",
    lead: "Каталог продуктов для сделок и проектов.",
    breadcrumb: [{ label: "Справочники" }, { label: "Продукты", current: true }],
    railSection: "directories",
    contextActiveItem: "Продукты",
    path: "/directories/products",
    requiredPermissions: ["tenant.products.read"]
  }),
  "09-admin": route({
    id: "09-admin",
    storyTitle: "09 Пользователи",
    pageTitle: "Пользователи",
    lead: "Пользователи и профили доступа рабочей области.",
    breadcrumb: [{ label: "Настройки" }, { label: "Пользователи", current: true }],
    railSection: "settings",
    contextActiveItem: "Пользователи",
    path: "/admin/users",
    requiredPermissions: ["tenant.users.read"]
  }),
  "10-settings": route({
    id: "10-settings",
    storyTitle: "10 Настройки",
    pageTitle: "Настройки рабочей области",
    lead: "Профиль, уведомления и интеграции.",
    breadcrumb: [{ label: "Настройки", current: true }],
    railSection: "settings",
    contextActiveItem: "Рабочая область",
    path: "/settings",
    requiredPermissions: ["tenant.workspace_config.read"]
  }),
  "11-avatar-menu": route({
    id: "11-avatar-menu",
    storyTitle: "11 Меню аватара",
    pageTitle: "Профиль пользователя",
    lead: "Меню аватара и быстрые действия.",
    breadcrumb: [{ label: "Профиль", current: true }],
    railSection: "overview",
    contextActiveItem: "Дашборд",
    path: "/profile"
  }),
  "12-project-gantt": route({
    id: "12-project-gantt",
    storyTitle: "12 Гант проекта",
    pageTitle: "Гант проекта",
    lead: "План-график проекта на живых задачах и сроках.",
    breadcrumb: [{ label: "Проекты" }, { label: "Карточка проекта" }, { label: "Гант", current: true }],
    railSection: "projects",
    contextActiveItem: "Гант",
    pageIntroActions: "none",
    path: "/projects/:projectId/timeline",
    requiredPermissions: ["tenant.project_plan.read"]
  }),
  "13-project-resources": route({
    id: "13-project-resources",
    storyTitle: "13 Ресурсы проекта",
    pageTitle: "Ресурсы проекта",
    lead: "Живая матрица загрузки и назначений проекта.",
    breadcrumb: [{ label: "Проекты" }, { label: "Карточка проекта" }, { label: "Ресурсы", current: true }],
    railSection: "projects",
    contextActiveItem: "Ресурсы",
    path: "/projects/:projectId/resources",
    requiredPermissions: ["tenant.project_resources.read"]
  }),
  "14-project-baseline": route({
    id: "14-project-baseline",
    storyTitle: "14 Базовый план проекта",
    pageTitle: mockProjectScreenTitle("Базовый план"),
    lead: "Снимки плана и отклонения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Базовый план", current: true }],
    railSection: "projects",
    contextActiveItem: "Базовый план",
    path: "/projects/demo/baseline",
    requiredPermissions: ["tenant.project_baselines.manage"]
  }),
  "15-project-scenarios": route({
    id: "15-project-scenarios",
    storyTitle: "15 Сценарии проекта",
    pageTitle: mockProjectScreenTitle("Сценарии"),
    lead: "Сценарии «что если» и сравнение вариантов.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Сценарии", current: true }],
    railSection: "projects",
    contextActiveItem: "Сценарии",
    path: "/projects/demo/scenarios",
    requiredPermissions: ["tenant.planning_scenarios.preview"]
  }),
  "16-project-kpi": route({
    id: "16-project-kpi",
    storyTitle: "16 KPI проекта",
    pageTitle: mockProjectScreenTitle("KPI"),
    lead: "Показатели и сигналы управления.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "KPI", current: true }],
    railSection: "projects",
    contextActiveItem: "KPI",
    path: "/projects/demo/kpi",
    requiredPermissions: ["tenant.kpi_definitions.read", "tenant.control_signals.read"]
  }),
  "17-project-audit": route({
    id: "17-project-audit",
    storyTitle: "17 Аудит",
    pageTitle: "Аудит действий",
    lead: "Журнал управленческих действий рабочей области.",
    breadcrumb: [{ label: "Настройки" }, { label: "Аудит", current: true }],
    railSection: "settings",
    contextActiveItem: "Аудит",
    path: "/admin/audit",
    requiredPermissions: ["tenant.audit_events.read"]
  }),
  "18-project-calendars": route({
    id: "18-project-calendars",
    storyTitle: "18 Календари проекта",
    pageTitle: mockProjectScreenTitle("Календари"),
    lead: "Рабочие календари и исключения.",
    breadcrumb: [{ label: "Проекты" }, { label: MOCK_PROJECT_CRM }, { label: "Календари", current: true }],
    railSection: "projects",
    contextActiveItem: "Календари",
    path: "/projects/demo/calendars",
    requiredPermissions: ["tenant.project_resources.read"]
  }),
  "19-login": route({
    id: "19-login",
    storyTitle: "19 Вход",
    pageTitle: "Войти в KISS PM",
    lead: "Используйте корпоративный email арендатора.",
    breadcrumb: [],
    railSection: "overview",
    contextActiveItem: "Дашборд",
    variant: "login",
    path: "/login"
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

export const DEFAULT_RUNTIME_SCREEN_ID: ScreenId = "01-dashboard";

export const SCREEN_ID_BY_PATH = Object.fromEntries(
  Object.values(SCREEN_ROUTE_BY_ID)
    .filter((meta): meta is ScreenRouteMeta & { path: string } => Boolean(meta.path))
    .map((meta) => [normalizeRuntimePath(meta.path), meta.id])
) as Record<string, ScreenId>;

export function normalizeRuntimePath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? "/";
  const normalized = `/${pathname.split("/").filter(Boolean).join("/")}`;
  return normalized === "/" ? "/" : normalized;
}

export function screenIdForPath(path: string): ScreenId | null {
  const normalized = normalizeRuntimePath(path);
  return SCREEN_ID_BY_PATH[normalized] ?? screenIdForDynamicRuntimePath(normalized);
}

export function projectIdForRuntimePath(path: string): string | null {
  const [, section, projectId, ...rest] = normalizeRuntimePath(path).split("/");
  if (section !== "projects") return null;
  if (rest.length > 1) return null;
  if (rest.length === 1 && !["timeline", "resources"].includes(rest[0] ?? "")) return null;
  if (!projectId || projectId === "demo" || projectId.startsWith(":")) return null;
  return projectId;
}

function screenIdForDynamicRuntimePath(path: string): ScreenId | null {
  const normalized = normalizeRuntimePath(path);
  const [, section, , view] = normalized.split("/");
  if (section === "projects" && view === "timeline" && projectIdForRuntimePath(path)) {
    return "12-project-gantt";
  }
  if (section === "projects" && view === "resources" && projectIdForRuntimePath(path)) {
    return "13-project-resources";
  }
  return projectIdForRuntimePath(path) ? "07b-project-detail" : null;
}

export function pathForScreenId(id: ScreenId): string | null {
  return SCREEN_ROUTE_BY_ID[id].path ?? null;
}

export function canOpenScreenRoute(
  meta: Pick<ScreenRouteMeta, "requiredPermissions" | "requiredPermissionMode">,
  permissions?: readonly string[]
): boolean {
  if (!permissions) return true;
  if (!meta.requiredPermissions?.length) return true;
  if (meta.requiredPermissionMode === "all") {
    return meta.requiredPermissions.every((permission) => permissions.includes(permission));
  }
  return meta.requiredPermissions.some((permission) => permissions.includes(permission));
}

export function canOpenRuntimePath(path: string, permissions?: readonly string[]): boolean {
  const screenId = screenIdForPath(path);
  if (!screenId || !isCurrentBetaRuntimeScreen(screenId)) return false;
  return canOpenScreenRoute(SCREEN_ROUTE_BY_ID[screenId], permissions);
}

export function railSectionsForPermissions(permissions?: readonly string[]) {
  return RAIL_SECTIONS.filter((section) => canOpenRuntimePath(section.href, permissions));
}
