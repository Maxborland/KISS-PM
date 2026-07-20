export type WorkspaceNavItem = {
  label: string;
  href: string;
  requires?: readonly string[];
};

export type WorkspaceNavGroup = {
  title: string;
  items: readonly WorkspaceNavItem[];
};

export type PaletteCommand = WorkspaceNavItem & {
  id: string;
  requiresAll?: readonly string[];
  keywords?: readonly string[];
};

export type PaletteSearchResultLocation = {
  id: string;
  type: string;
  route: string;
  entityId?: string;
};

export const AGENT_TOOL_PERMISSIONS = [
  "tenant.projects.read",
  "tenant.project_plan.read",
  "tenant.project_resources.read",
  "tenant.planning_scenarios.preview",
  "tenant.opportunities.read",
  "tenant.clients.read",
  "tenant.contacts.read",
  "tenant.products.read",
  "tenant.crm_pipelines.read",
  "tenant.communications.read",
  "tenant.users.read",
  "tenant.access_profiles.read",
  "tenant.org_structure.read",
  "tenant.positions.read"
] as const;

export const WORKSPACE_NAV_GROUPS: readonly WorkspaceNavGroup[] = [
  {
    title: "Работа",
    items: [
      { label: "Агент", href: "/agent", requires: AGENT_TOOL_PERMISSIONS },
      { label: "Мои задачи", href: "/my-work", requires: ["tenant.projects.read"] },
      { label: "Проекты", href: "/projects", requires: ["tenant.projects.read"] },
      { label: "Сделки", href: "/crm/deals", requires: ["tenant.opportunities.read"] }
    ]
  },
  {
    title: "Аналитика",
    items: [
      { label: "Дашборд", href: "/dashboard", requires: ["tenant.projects.read", "tenant.opportunities.read"] }
    ]
  },
  {
    title: "Коммуникации",
    items: [
      { label: "Коммуникации", href: "/communications/chat", requires: ["tenant.communications.read"] }
    ]
  },
  {
    title: "Администрирование",
    items: [
      {
        label: "Администрирование",
        href: "/admin",
        requires: [
          "tenant.access_profiles.read",
          "tenant.access_profiles.manage",
          "tenant.users.read",
          "tenant.users.manage",
          "tenant.audit_events.read",
          "tenant.workspace_config.read",
          "tenant.workspace_config.manage"
        ]
      }
    ]
  }
] as const;

const CRM_DEALS_CONTEXT_PERMISSIONS = [
  "tenant.opportunities.read",
  "tenant.deal_stages.read",
  "tenant.clients.read",
  "tenant.contacts.read",
  "tenant.products.read",
  "tenant.project_types.read",
  "tenant.crm_pipelines.read"
] as const;

const WORKSPACE_ACTIONS: readonly PaletteCommand[] = [
  {
    id: "action:create-deal",
    label: "Создать сделку",
    href: "/crm/deals?create=deal",
    requiresAll: CRM_DEALS_CONTEXT_PERMISSIONS,
    requires: ["tenant.opportunities.manage"],
    keywords: ["новая", "crm", "продажа"]
  }
] as const;

function hasAllPermissions(
  permissions: readonly string[],
  required?: readonly string[]
): boolean {
  return !required || required.every((permission) => permissions.includes(permission));
}

export function hasAnyPermission(
  permissions: readonly string[],
  required?: readonly string[]
): boolean {
  return !required || required.length === 0 || required.some((permission) => permissions.includes(permission));
}

export function getPaletteCommands({
  loaded,
  permissions
}: {
  loaded: boolean;
  permissions: readonly string[] | null;
}): { navigation: PaletteCommand[]; actions: PaletteCommand[] } {
  if (!loaded || !permissions) return { navigation: [], actions: [] };

  const navigation = WORKSPACE_NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => hasAnyPermission(permissions, item.requires))
    .map((item) => ({
      ...item,
      id: `navigation:${item.href}`
    }));
  const actions = WORKSPACE_ACTIONS.filter((item) => hasAnyPermission(permissions, item.requires) && hasAllPermissions(permissions, item.requiresAll));
  return { navigation, actions };
}

// Маршрутизация сущностей принадлежит ОДНОМУ слою — API (apps/api/src/search/searchRouting.ts).
// Раньше палитра переписывала route для задач и сделок здесь, поэтому остальные
// потребители того же поля (вложения, почтовый дайджест уведомлений — он шлёт
// item.route дословно) получали непропатченное значение и расходились с палитрой.
export function paletteRouteForSearchResult(result: PaletteSearchResultLocation): string {
  return result.route;
}
