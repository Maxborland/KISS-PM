import {
  createTenantAdminSeedProfile,
  type SeedAccessProfile,
  type SeedPosition,
  type SeedProjectType,
  type SeedTenantDataset,
  type SeedTenantUser
} from "@kiss-pm/persistence";

export type TenantScenarioInput = {
  tenantId?: string;
  tenantName?: string;
  adminAccessProfileId?: string;
  adminUserId?: string;
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
  positions?: readonly SeedPosition[];
  projectTypes?: readonly SeedProjectType[];
  accessProfiles?: readonly SeedAccessProfile[];
  users?: readonly SeedTenantUser[];
};

export function createTenantScenarioDataset(input: TenantScenarioInput = {}): SeedTenantDataset {
  const tenantId = input.tenantId ?? "tenant-alpha";
  const adminAccessProfileId = input.adminAccessProfileId ?? "access-profile-admin";
  const adminUserId = input.adminUserId ?? "user-alpha-admin";
  const positions = input.positions ?? [
    { id: "position-manager", tenantId, name: "Руководитель проекта" },
    { id: "position-engineer", tenantId, name: "Инженер" }
  ];

  return {
    tenants: [{ id: tenantId, name: input.tenantName ?? "Альфа Проект" }],
    accessProfiles: [
      createTenantAdminSeedProfile({
        id: adminAccessProfileId,
        tenantId
      }),
      ...(input.accessProfiles ?? [])
    ],
    positions,
    clients: [{ id: "client-romashka", tenantId, name: "ООО Ромашка" }],
    projectTypes: input.projectTypes ?? [
      { id: "project-type-implementation", tenantId, name: "Внедрение" }
    ],
    users: [
      {
        id: adminUserId,
        tenantId,
        email: input.adminEmail ?? "admin@kiss-pm.local",
        name: input.adminName ?? "Анна Администратор",
        accessProfileId: adminAccessProfileId,
        positionId: positions[0]?.id ?? null,
        password: input.adminPassword ?? "admin12345"
      },
      ...(input.users ?? [])
    ]
  };
}
