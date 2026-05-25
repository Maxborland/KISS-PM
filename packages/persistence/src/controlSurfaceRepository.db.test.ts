import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ControlSurfaceDefinition } from "@kiss-pm/domain";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createControlSurfaceRepository } from "./controlSurfaceRepository";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

const seed: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Альфа Проект" },
    { id: "tenant-beta", name: "Бета Проект" }
  ],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.control_surfaces.read",
        "tenant.control_surfaces.manage",
        "tenant.control_surfaces.publish"
      ]
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Администратор",
      permissions: ["tenant.control_surfaces.read"]
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@alpha.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      password: "local-admin-password"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "admin@beta.local",
      name: "Борис Администратор",
      accessProfileId: "access-profile-beta-admin",
      password: "local-admin-password"
    }
  ]
};

describe("control surface repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await truncateControlSurfacesDb(client);
    await seedTenantDataset(createDatabase(client), seed, new Date("2026-05-25T00:00:00.000Z"));
  });

  afterAll(async () => {
    await truncateControlSurfacesDb(client);
    await client.end();
  });

  it("persists drafts, published versions, rollback versions and tenant isolation", async () => {
    const repository = createControlSurfaceRepository(createDatabase(client));
    const draft = await repository.upsertControlSurfaceDraft({
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      definition: createDefinition("tenant-alpha", "surface-alpha", "delivery")
    });

    expect(draft.status).toBe("draft");
    expect(draft.currentVersion).toBe(0);
    expect(draft.draftVersion).toBe(1);

    const firstPublish = await repository.publishControlSurface({
      tenantId: "tenant-alpha",
      surfaceId: draft.id,
      actorUserId: "user-alpha-admin",
      auditEventId: "audit-publish-1"
    });
    expect(firstPublish.surface.status).toBe("published");
    expect(firstPublish.surface.currentVersion).toBe(1);
    expect(firstPublish.version.version).toBe(1);
    expect(firstPublish.version.auditEventId).toBe("audit-publish-1");

    await repository.upsertControlSurfaceDraft({
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      definition: {
        ...createDefinition("tenant-alpha", "surface-alpha", "delivery"),
        name: "Project Delivery v2"
      }
    });
    const secondPublish = await repository.publishControlSurface({
      tenantId: "tenant-alpha",
      surfaceId: draft.id,
      actorUserId: "user-alpha-admin",
      auditEventId: "audit-publish-2"
    });
    expect(secondPublish.surface.currentVersion).toBe(2);
    expect(secondPublish.surface.publishedDefinition?.name).toBe("Project Delivery v2");
    expect(secondPublish.version.auditEventId).toBe("audit-publish-2");

    const rollback = await repository.rollbackControlSurfaceToVersion({
      tenantId: "tenant-alpha",
      surfaceId: draft.id,
      version: 1,
      actorUserId: "user-alpha-admin",
      auditEventId: "audit-rollback"
    });
    expect(rollback?.surface.currentVersion).toBe(3);
    expect(rollback?.surface.publishedDefinition?.name).toBe("Project Delivery");
    expect(rollback?.version.auditEventId).toBe("audit-rollback");
    expect(await repository.listControlSurfaceVersions("tenant-alpha", draft.id)).toHaveLength(3);
    expect(await repository.listControlSurfaces("tenant-beta")).toEqual([]);
  });

  it("archives definitions without deleting version history", async () => {
    const repository = createControlSurfaceRepository(createDatabase(client));
    const draft = await repository.upsertControlSurfaceDraft({
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      definition: createDefinition("tenant-alpha", "surface-alpha", "delivery")
    });
    await repository.publishControlSurface({
      tenantId: "tenant-alpha",
      surfaceId: draft.id,
      actorUserId: "user-alpha-admin"
    });

    const archived = await repository.archiveControlSurface({
      tenantId: "tenant-alpha",
      surfaceId: draft.id,
      actorUserId: "user-alpha-admin"
    });

    expect(archived?.status).toBe("archived");
    expect(archived?.archivedAt).not.toBeNull();
    expect(await repository.listControlSurfaceVersions("tenant-alpha", draft.id)).toHaveLength(1);

    await expect(
      repository.upsertControlSurfaceDraft({
        tenantId: "tenant-alpha",
        actorUserId: "user-alpha-admin",
        definition: {
          ...createDefinition("tenant-alpha", "surface-alpha", "delivery"),
          name: "Implicit unarchive attempt"
        }
      })
    ).rejects.toThrow("control_surface_archived");

    const afterRejectedDraftSave = await repository.findControlSurface("tenant-alpha", draft.id);
    expect(afterRejectedDraftSave?.status).toBe("archived");
    expect(afterRejectedDraftSave?.archivedAt).not.toBeNull();
  });
});

async function truncateControlSurfacesDb(client: PostgresClient) {
  await client`TRUNCATE control_surface_versions, control_surface_definitions, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, access_profiles, tenants RESTART IDENTITY CASCADE`;
}

function createDefinition(
  tenantId: string,
  id: string,
  code: string
): ControlSurfaceDefinition {
  return {
    id,
    tenantId,
    code,
    name: "Project Delivery",
    description: null,
    dataSource: "project_delivery",
    entityType: "project",
    viewType: "gantt",
    fields: [{ id: "title", label: "Название", sourceField: "title", visible: true }],
    filters: [],
    groupings: [],
    widgets: [],
    severityRules: [],
    drilldowns: [],
    actions: [
      {
        id: "open-gantt",
        label: "Открыть график",
        actionKey: "open_gantt",
        scope: "row",
        requiredPermissions: ["tenant.project_plan.read"]
      }
    ],
    requiredPermissions: ["tenant.projects.read"],
    savedViewPolicy: "user",
    auditPolicy: "publish_only"
  };
}
