import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createProjectIntakeRepository } from "./projectIntakeRepository";
import { createProjectResourcePoolRepository } from "./projectResourcePoolRepository";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const projectResourcePoolSeed: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Tenant Alpha" }],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Admin",
      permissions: ["tenant.projects.read", "tenant.projects.manage"]
    }
  ],
  positions: [{ id: "position-engineer", tenantId: "tenant-alpha", name: "Engineer" }],
  clients: [{ id: "client-alpha", tenantId: "tenant-alpha", name: "Client Alpha" }],
  projectTypes: [{ id: "project-type-alpha", tenantId: "tenant-alpha", name: "Implementation" }],
  users: [
    {
      id: "user-alpha-manager",
      tenantId: "tenant-alpha",
      email: "manager@kiss-pm.local",
      name: "Manager",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "manager12345"
    },
    {
      id: "user-alpha-resource",
      tenantId: "tenant-alpha",
      email: "resource@kiss-pm.local",
      name: "Resource",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "resource12345"
    }
  ]
};

describe("project resource pool repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await client`TRUNCATE project_resource_pool_members, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      projectResourcePoolSeed,
      new Date("2026-05-19T00:00:00.000Z")
    );
    await createActiveProject(client);
  });

  afterAll(async () => {
    await client`TRUNCATE project_resource_pool_members, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("fully replaces tenant-scoped project resource pool members", async () => {
    const repository = createProjectResourcePoolRepository(createDatabase(client));

    const initial = await repository.replaceProjectResourcePoolMembers({
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      members: [
        { userId: "user-alpha-manager", role: "project_manager" },
        { userId: "user-alpha-resource", role: "resource" }
      ]
    });

    expect(initial.map((member) => [member.userId, member.role])).toEqual([
      ["user-alpha-manager", "project_manager"],
      ["user-alpha-resource", "resource"]
    ]);

    const replaced = await repository.replaceProjectResourcePoolMembers({
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      members: [{ userId: "user-alpha-resource", role: "observer" }]
    });

    expect(replaced.map((member) => [member.userId, member.role])).toEqual([
      ["user-alpha-resource", "observer"]
    ]);
    await expect(
      repository.listProjectResourcePoolMembers("tenant-alpha", "project-alpha")
    ).resolves.toEqual(replaced);
  });
});

async function createActiveProject(client: PostgresClient) {
  const intakeRepository = createProjectIntakeRepository(createDatabase(client));
  const opportunity = await intakeRepository.createOpportunity({
    id: "opportunity-alpha",
    tenantId: "tenant-alpha",
    clientId: "client-alpha",
    primaryContactId: null,
    projectTypeId: "project-type-alpha",
    stageId: null,
    clientName: "Client Alpha",
    contactName: "Contact Alpha",
    title: "Project Alpha",
    projectType: "Implementation",
    description: null,
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 1000000,
    plannedHourlyRate: 5000,
    plannedHours: 200,
    probability: 80,
    status: "ready_to_activate",
    templateId: null,
    demand: [{ positionId: "position-engineer", requiredHours: 80 }]
  });
  const draft = await intakeRepository.createProjectDraftFromOpportunity({
    id: "project-alpha",
    tenantId: "tenant-alpha",
    sourceOpportunityId: opportunity.id,
    clientId: opportunity.clientId,
    projectTypeId: opportunity.projectTypeId,
    title: opportunity.title,
    clientName: opportunity.clientName,
    status: "draft",
    plannedStart: opportunity.plannedStart,
    plannedFinish: opportunity.plannedFinish,
    contractValue: opportunity.contractValue,
    plannedHours: opportunity.plannedHours,
    templateId: null,
    demand: opportunity.demand
  });
  await intakeRepository.activateProjectDraft({
    tenantId: "tenant-alpha",
    projectId: draft.id
  });
}
