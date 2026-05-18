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
  { id: "admin", label: "Администрирование" },
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
  return (
    workspaceRoutes.find((route) => route.path === normalizePathname(pathname))?.id ??
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
