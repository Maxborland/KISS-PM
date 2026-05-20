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
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
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
  clients: [
    {
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка",
      description: "Демо-клиент для CRM intake"
    }
  ],
  contacts: [
    {
      id: "contact-irina",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      name: "Ирина Клиент",
      email: "irina@romashka.example",
      phone: "+7 913 000-00-00",
      telegram: "@irina_client",
      role: "Заказчик"
    }
  ],
  products: [
    {
      id: "product-kiss-pm-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение KISS PM",
      sku: "KISS-IMPL",
      type: "service",
      unit: "час",
      price: 6000,
      description: "Проектная услуга внедрения и настройки управленческого контура"
    },
    {
      id: "product-project-audit",
      tenantId: "tenant-alpha",
      name: "Аудит проектного контура",
      sku: "KISS-AUDIT",
      type: "service",
      unit: "пакет",
      price: 180000,
      description: "Разовый аудит проектов, ресурсов и управленческих сигналов"
    }
  ],
  projectTypes: [
    {
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение",
      description: "Проект внедрения продукта или системы"
    }
  ],
  dealStages: [
    {
      id: "deal-stage-new",
      tenantId: "tenant-alpha",
      name: "Новая",
      sortOrder: 10
    },
    {
      id: "deal-stage-qualified",
      tenantId: "tenant-alpha",
      name: "Квалификация",
      sortOrder: 20
    },
    {
      id: "deal-stage-ready",
      tenantId: "tenant-alpha",
      name: "Готова к оценке",
      sortOrder: 30
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
    password: user.id === "user-alpha-admin" ? "admin12345" : "beta12345"
  })).concat([
    {
      id: "user-alpha-engineer",
      tenantId: "tenant-alpha",
      name: "Игорь Инженер",
      accessProfileId: "access-profile-alpha-admin",
      email: "engineer@kiss-pm.local",
      positionId: "position-engineer",
      password: "engineer12345"
    }
  ])
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
