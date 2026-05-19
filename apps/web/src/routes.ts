export const workspaceRoutes = [
  {
    id: "dashboard",
    label: "Главная",
    group: "workspace",
    path: "/dashboard",
    permission: null,
    description: "Контекст рабочего пространства и быстрые показатели"
  },
  {
    id: "my-work",
    label: "Моя работа",
    group: "workspace",
    path: "/my-work",
    permission: "tenant.projects.read",
    description: "Задачи, где текущий пользователь является участником"
  },
  {
    id: "opportunities",
    label: "Сделки",
    group: "workspace",
    path: "/opportunities",
    permission: "tenant.opportunities.read",
    description: "CRM-вход, потребность по должностям и ресурсная проверка"
  },
  {
    id: "projects",
    label: "Проекты",
    group: "workspace",
    path: "/projects",
    permission: "tenant.projects.read",
    description: "Активные проекты, плановые даты и потребность по должностям"
  },
  {
    id: "clients",
    label: "Клиенты",
    group: "crm",
    path: "/clients",
    permission: "tenant.clients.read",
    description: "CRM-клиенты как отдельный справочник входящего контура"
  },
  {
    id: "contacts",
    label: "Контакты",
    group: "crm",
    path: "/contacts",
    permission: "tenant.contacts.read",
    description: "Контакты клиентов для сделок и будущих коммуникаций"
  },
  {
    id: "users",
    label: "Пользователи",
    group: "admin",
    path: "/users",
    permission: "tenant.users.read",
    description: "Учетные записи, роли доступа, должности и статус"
  },
  {
    id: "access-roles",
    label: "Роли доступа",
    group: "admin",
    path: "/access-roles",
    permission: "tenant.access_profiles.read",
    description: "RBAC-профили и наборы разрешений"
  },
  {
    id: "positions",
    label: "Должности",
    group: "admin",
    path: "/positions",
    permission: "tenant.positions.read",
    description: "Рабочие должности и назначенные пользователи"
  },
  {
    id: "audit",
    label: "Аудит",
    group: "admin",
    path: "/audit",
    permission: "tenant.audit_events.read",
    description: "Журнал административных действий и настроек"
  },
  {
    id: "settings",
    label: "Поля и шаблоны",
    group: "settings",
    path: "/settings",
    permission: "tenant.workspace_config.read",
    description: "Пользовательские поля и шаблоны проекта"
  },
  {
    id: "project-types",
    label: "Типы проектов",
    group: "settings",
    path: "/settings/project-types",
    permission: "tenant.project_types.read",
    description: "Tenant-настраиваемые типы проектов для сделок и проектов"
  },
  {
    id: "deal-stages",
    label: "Этапы сделок",
    group: "settings",
    path: "/settings/deal-stages",
    permission: "tenant.deal_stages.read",
    description: "Tenant-настраиваемые этапы, из которых строится канбан сделок"
  },
  {
    id: "profile",
    label: "Профиль",
    group: "personal",
    path: "/profile",
    permission: "profile.read",
    description: "Личные данные и контактные поля"
  },
  {
    id: "theme",
    label: "Оформление",
    group: "personal",
    path: "/theme",
    permission: "workspace.theme.manage",
    description: "Тема интерфейса и акцентный цвет"
  }
] as const;

export type WorkspaceRoute = (typeof workspaceRoutes)[number];
export type WorkspaceRouteId = WorkspaceRoute["id"];
export type WorkspaceRouteGroupId = WorkspaceRoute["group"];

const workspaceRouteGroups = [
  { id: "workspace", label: "Работа" },
  { id: "crm", label: "CRM" },
  { id: "admin", label: "Администрирование" },
  { id: "settings", label: "Настройки" },
  { id: "personal", label: "Личное" }
] as const satisfies readonly {
  id: WorkspaceRouteGroupId;
  label: string;
}[];

export function getVisibleRoutes(permissions: readonly string[]): WorkspaceRoute[] {
  return workspaceRoutes.filter(
    (route) => route.permission === null || permissions.includes(route.permission)
  );
}

export function getVisibleRouteGroups(permissions: readonly string[]) {
  const visibleRoutes = getVisibleRoutes(permissions);

  return workspaceRouteGroups
    .map((group) => ({
      ...group,
      routes: visibleRoutes.filter((route) => route.group === group.id)
    }))
    .filter((group) => group.routes.length > 0);
}

export function getDefaultRouteId(
  requestedRouteId: WorkspaceRouteId,
  permissions: readonly string[]
): WorkspaceRouteId {
  const visibleRoute = getVisibleRoutes(permissions).find(
    (route) => route.id === requestedRouteId
  );

  return visibleRoute?.id ?? "dashboard";
}

export function isRouteId(value: string): value is WorkspaceRouteId {
  return workspaceRoutes.some((route) => route.id === value);
}

export function getRouteById(routeId: WorkspaceRouteId): WorkspaceRoute {
  return workspaceRoutes.find((route) => route.id === routeId) ?? workspaceRoutes[0];
}

export function getRouteIdFromPathname(pathname: string): WorkspaceRouteId {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath.startsWith("/opportunities/")) return "opportunities";
  if (normalizedPath.startsWith("/projects/")) return "projects";
  if (normalizedPath.startsWith("/clients/")) return "clients";
  if (normalizedPath.startsWith("/contacts/")) return "contacts";

  return (
    workspaceRoutes.find((route) => route.path === normalizedPath)?.id ??
    "dashboard"
  );
}

export function getRoutePath(routeId: WorkspaceRouteId): string {
  return getRouteById(routeId).path;
}

export function findRouteByQuery(
  routes: readonly WorkspaceRoute[],
  query: string
): WorkspaceRoute | undefined {
  const normalizedQuery = normalizeRouteSearch(query);
  if (!normalizedQuery) return undefined;

  return (
    routes.find((route) => normalizeRouteSearch(route.label) === normalizedQuery) ??
    routes.find((route) => normalizeRouteSearch(route.label).startsWith(normalizedQuery)) ??
    routes.find((route) =>
      normalizeRouteSearch(`${route.label} ${route.description}`).includes(normalizedQuery)
    )
  );
}

function normalizeRouteSearch(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePathname(pathname: string): string {
  const normalizedPathname = pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;
  return normalizedPathname || "/";
}
