import {
  createTenant,
  createTenantIsolationProbe,
  createTenantUser,
  createWorkspace
} from "@kiss-pm/domain-core";
import type { Tenant, TenantIsolationProbe, TenantUser, Workspace } from "@kiss-pm/domain-core";

export type DemoTenantUser = {
  id: string;
  tenantId: string;
  displayName: string;
  roleKey: string;
  accessProfileId?: string;
};

export type DemoTenant = {
  id: string;
  label: string;
  configurationVersion: number;
  workspaces: Workspace[];
  users: DemoTenantUser[];
  isolationProbe: TenantIsolationProbe;
  fixtureNote: string;
};

function createDemoTenantUser(input: TenantUser & { roleKey: string }): DemoTenantUser {
  return {
    id: input.id,
    tenantId: input.tenantId,
    displayName: input.displayName,
    roleKey: input.roleKey,
    ...(input.accessProfileId ? { accessProfileId: input.accessProfileId } : {})
  };
}

const tenantA: Tenant = createTenant({
  id: "tenant-a",
  label: "Студия A",
  configurationVersion: 1
});
const tenantB: Tenant = createTenant({
  id: "tenant-b",
  label: "Студия B",
  configurationVersion: 1
});

const demoTenants: DemoTenant[] = [
  {
    id: tenantA.id,
    label: tenantA.label,
    configurationVersion: tenantA.configurationVersion,
    fixtureNote: "Тенант A: синтетическая фикстура для smoke-проверок Фазы 1.",
    workspaces: [
      createWorkspace({
        id: "workspace-a-main",
        tenantId: tenantA.id,
        label: "Основное пространство A"
      })
    ],
    isolationProbe: createTenantIsolationProbe({
      id: "probe-a-private",
      tenantId: tenantA.id,
      label: "Закрытые данные Tenant A"
    }),
    users: [
      createDemoTenantUser({
        ...createTenantUser({
          id: "tenant-admin-a",
          tenantId: tenantA.id,
          displayName: "Администратор",
          accessProfileId: "profile-tenant-admin-a"
        }),
        roleKey: "tenant_admin"
      }),
      createDemoTenantUser({
        ...createTenantUser({
          id: "project-manager-a",
          tenantId: tenantA.id,
          displayName: "Руководитель проекта",
          accessProfileId: "profile-project-manager-a"
        }),
        roleKey: "project_manager"
      }),
      createDemoTenantUser({
        ...createTenantUser({
          id: "resource-manager-a",
          tenantId: tenantA.id,
          displayName: "Ресурсный менеджер",
          accessProfileId: "profile-resource-manager-a"
        }),
        roleKey: "resource_manager"
      }),
      createDemoTenantUser({
        ...createTenantUser({
          id: "executor-a",
          tenantId: tenantA.id,
          displayName: "Исполнитель",
          accessProfileId: "profile-executor-a"
        }),
        roleKey: "executor"
      }),
      createDemoTenantUser({
        ...createTenantUser({
          id: "readonly-observer-a",
          tenantId: tenantA.id,
          displayName: "Наблюдатель",
          accessProfileId: "profile-readonly-observer-a"
        }),
        roleKey: "readonly_observer"
      })
    ]
  },
  {
    id: tenantB.id,
    label: tenantB.label,
    configurationVersion: tenantB.configurationVersion,
    fixtureNote: "Тенант B: синтетическая фикстура для будущих проверок изоляции.",
    workspaces: [
      createWorkspace({
        id: "workspace-b-main",
        tenantId: tenantB.id,
        label: "Основное пространство B"
      })
    ],
    isolationProbe: createTenantIsolationProbe({
      id: "probe-b-private",
      tenantId: tenantB.id,
      label: "Закрытые данные Tenant B"
    }),
    users: [
      createDemoTenantUser({
        ...createTenantUser({
          id: "tenant-admin-b",
          tenantId: tenantB.id,
          displayName: "Администратор B",
          accessProfileId: "profile-tenant-admin-b"
        }),
        roleKey: "tenant_admin"
      }),
      createDemoTenantUser({
        ...createTenantUser({
          id: "user-b",
          tenantId: tenantB.id,
          displayName: "Пользователь B",
          accessProfileId: "profile-tenant-user-b"
        }),
        roleKey: "tenant_user"
      })
    ]
  }
];

export function getDemoTenants(): DemoTenant[] {
  return demoTenants.map((tenant) => ({
    ...tenant,
    workspaces: tenant.workspaces.map((workspace) => ({ ...workspace })),
    isolationProbe: { ...tenant.isolationProbe },
    users: tenant.users.map((user) => ({ ...user }))
  }));
}

export function getDemoTenantSummary() {
  return getDemoTenants()
    .map((tenant) => `${tenant.fixtureNote} Пользователей: ${tenant.users.length}`)
    .join(" ");
}
