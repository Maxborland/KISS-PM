export type DemoTenantUser = {
  id: string;
  displayName: string;
  roleKey: string;
};

export type DemoTenant = {
  id: string;
  label: string;
  users: DemoTenantUser[];
  fixtureNote: string;
};

const demoTenants = [
  {
    id: "tenant-a",
    label: "Студия A",
    fixtureNote: "Тенант A: синтетическая фикстура для smoke-проверок Фазы 1.",
    users: [
      { id: "tenant-admin-a", displayName: "Администратор", roleKey: "tenant_admin" },
      { id: "project-manager-a", displayName: "Руководитель проекта", roleKey: "project_manager" },
      { id: "resource-manager-a", displayName: "Ресурсный менеджер", roleKey: "resource_manager" },
      { id: "executor-a", displayName: "Исполнитель", roleKey: "executor" },
      { id: "readonly-observer-a", displayName: "Наблюдатель", roleKey: "readonly_observer" }
    ]
  },
  {
    id: "tenant-b",
    label: "Студия B",
    fixtureNote: "Тенант B: синтетическая фикстура для будущих проверок изоляции.",
    users: [
      { id: "tenant-admin-b", displayName: "Администратор B", roleKey: "tenant_admin" },
      { id: "user-b", displayName: "Пользователь B", roleKey: "tenant_user" }
    ]
  }
] satisfies DemoTenant[];

export function getDemoTenants(): DemoTenant[] {
  return demoTenants.map((tenant) => ({
    ...tenant,
    users: tenant.users.map((user) => ({ ...user }))
  }));
}

export function getDemoTenantSummary() {
  return getDemoTenants()
    .map((tenant) => `${tenant.fixtureNote} Пользователей: ${tenant.users.length}`)
    .join(" ");
}
