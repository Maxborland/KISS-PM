import { createTenant, createTenantUser, type Tenant, type TenantUser } from "@kiss-pm/domain";

export type DemoTenantDataset = {
  tenants: Tenant[];
  users: TenantUser[];
};

export function createDemoTenantDataset(): DemoTenantDataset {
  const alpha = createTenant({ id: "tenant-alpha", name: "Альфа Проект" });
  const beta = createTenant({ id: "tenant-beta", name: "Бета Проект" });

  return {
    tenants: [alpha, beta],
    users: [
      createTenantUser({
        id: "user-alpha-admin",
        tenantId: alpha.id,
        name: "Анна Администратор",
        accessProfileId: "access-profile-alpha-admin"
      }),
      createTenantUser({
        id: "user-beta-admin",
        tenantId: beta.id,
        name: "Борис Администратор",
        accessProfileId: "access-profile-beta-admin"
      })
    ]
  };
}
