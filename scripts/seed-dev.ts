import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import {
  createDatabase,
  createPostgresClient,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";
const demo = createDemoTenantDataset();
const dataset: SeedTenantDataset = {
  tenants: demo.tenants,
  accessProfiles: demo.tenants.map((tenant) =>
    createTenantAdminSeedProfile({
      id:
        tenant.id === "tenant-alpha"
          ? "access-profile-alpha-admin"
          : "access-profile-beta-admin",
      tenantId: tenant.id
    })
  ),
  positions: [
    {
      id: "position-project-manager",
      tenantId: "tenant-alpha",
      name: "Руководитель проекта",
      description: "Отвечает за план, ресурсы и управленческий контур проекта"
    },
    {
      id: "position-engineer",
      tenantId: "tenant-alpha",
      name: "Инженер",
      description: "Участвует в проектных работах и ресурсном планировании"
    }
  ],
  users: demo.users.map((user) => ({
    ...user,
    email:
      user.id === "user-alpha-admin"
        ? "admin@kiss-pm.local"
        : "beta@kiss-pm.local",
    positionId:
      user.id === "user-alpha-admin" ? "position-project-manager" : null,
    password: user.id === "user-alpha-admin" ? "local-admin-password" : "local-beta-password"
  }))
};
const client = createPostgresClient(databaseUrl);

try {
  await seedTenantDataset(
    createDatabase(client),
    dataset,
    new Date("2026-05-18T00:00:00.000Z")
  );
  console.log("Seeded dev tenants and users");
} finally {
  await client.end();
}
