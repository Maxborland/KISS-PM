import { createAccessProfile, permissions } from "@kiss-pm/access-control";
import type { TenantUser, UserId } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import { createApp } from "./app";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  CustomFieldDefinitionRecord,
  PositionRecord,
  WorkspaceUserRecord
} from "./apiTypes";

const cookie = "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function createSessionDataSource(
  actor: TenantUser,
  profile: AccessProfileRecord,
  overrides: Partial<ApiTenantDataSource> = {}
): Partial<ApiTenantDataSource> {
  return {
    async findSessionByTokenHash() {
      return {
        id: "session-admin-read-model",
        tenantId: actor.tenantId,
        userId: actor.id,
        tokenHash: "ignored",
        expiresAt: new Date("2026-07-01T00:00:00.000Z")
      };
    },
    async findUserById(userId) {
      return userId === actor.id ? actor : undefined;
    },
    async findAccessProfileById(tenantId, accessProfileId) {
      return tenantId === profile.tenantId && accessProfileId === profile.id ? profile : undefined;
    },
    ...overrides
  };
}

describe("admin read model routes", () => {
  it("returns a coherent tenant-scoped admin setup model", async () => {
    const tenantId = "tenant-alpha";
    const actor: TenantUser = {
      id: "user-admin" as UserId,
      tenantId,
      name: "Admin",
      accessProfileId: "tenant-admin"
    };
    const adminProfile: AccessProfileRecord = {
      ...createAccessProfile({
        id: "tenant-admin",
        permissions: [
          "tenant.users.read",
          "tenant.access_profiles.read",
          "tenant.positions.read",
          "tenant.workspace_config.read"
        ]
      }),
      tenantId,
      name: "Tenant admin"
    };
    const accessRoles: AccessProfileRecord[] = [
      adminProfile,
      {
        ...createAccessProfile({
          id: "crm-reader",
          permissions: ["tenant.clients.read"]
        }),
        tenantId,
        name: "CRM reader"
      }
    ];
    const users: WorkspaceUserRecord[] = [
      {
        id: "user-admin" as UserId,
        tenantId,
        email: "admin@kiss-pm.local",
        name: "Admin",
        accessProfileId: "tenant-admin",
        positionId: "position-admin",
        positionName: "Administrator",
        phone: null,
        telegram: null,
        status: "active",
        theme: "light",
        accentColor: "teal"
      }
    ];
    const positions: PositionRecord[] = [
      {
        id: "position-admin",
        tenantId,
        name: "Administrator",
        description: "Owns workspace setup"
      }
    ];
    const customFields: CustomFieldDefinitionRecord[] = [
      {
        id: "field-budget",
        tenantId,
        systemKey: "budget",
        tenantLabel: "Budget",
        targetEntity: "opportunity",
        fieldType: "number",
        required: false,
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z")
      }
    ];
    const tenantIdsSeen: string[] = [];
    const dataSource = createSessionDataSource(actor, adminProfile, {
      async listWorkspaceUsers(listTenantId) {
        tenantIdsSeen.push(`users:${listTenantId}`);
        return users;
      },
      async listPositions(listTenantId) {
        tenantIdsSeen.push(`positions:${listTenantId}`);
        return positions;
      },
      async listAccessProfilesByTenantId(listTenantId) {
        tenantIdsSeen.push(`accessRoles:${listTenantId}`);
        return accessRoles;
      },
      async listCustomFieldDefinitions(listTenantId) {
        tenantIdsSeen.push(`customFields:${listTenantId}`);
        return customFields;
      }
    });
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/admin/read-model", {
      headers: { cookie }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users,
      positions,
      accessRoles,
      permissionCatalogue: permissions,
      customFields: [
        {
          ...customFields[0],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      ]
    });
    expect(tenantIdsSeen).toEqual([
      "users:tenant-alpha",
      "users:tenant-alpha",
      "positions:tenant-alpha",
      "accessRoles:tenant-alpha",
      "customFields:tenant-alpha"
    ]);
  });

  it("denies the composed model when the actor cannot read every admin slice", async () => {
    const tenantId = "tenant-alpha";
    const actor: TenantUser = {
      id: "user-reader" as UserId,
      tenantId,
      name: "Reader",
      accessProfileId: "crm-reader"
    };
    const crmReaderProfile: AccessProfileRecord = {
      ...createAccessProfile({
        id: "crm-reader",
        permissions: ["tenant.clients.read"]
      }),
      tenantId,
      name: "CRM reader"
    };
    const listCalls: string[] = [];
    const dataSource = createSessionDataSource(actor, crmReaderProfile, {
      async listWorkspaceUsers() {
        listCalls.push("listWorkspaceUsers");
        return [];
      },
      async listPositions() {
        listCalls.push("listPositions");
        return [];
      },
      async listAccessProfilesByTenantId() {
        listCalls.push("listAccessProfilesByTenantId");
        return [];
      },
      async listCustomFieldDefinitions() {
        listCalls.push("listCustomFieldDefinitions");
        return [];
      }
    });
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/admin/read-model", {
      headers: { cookie }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(listCalls).toEqual(["listWorkspaceUsers"]);
  });

  it("reports persistence_not_configured when an admin read-model source is unavailable", async () => {
    const tenantId = "tenant-alpha";
    const actor: TenantUser = {
      id: "user-admin" as UserId,
      tenantId,
      name: "Admin",
      accessProfileId: "tenant-admin"
    };
    const adminProfile: AccessProfileRecord = {
      ...createAccessProfile({
        id: "tenant-admin",
        permissions: [
          "tenant.users.read",
          "tenant.access_profiles.read",
          "tenant.positions.read",
          "tenant.workspace_config.read"
        ]
      }),
      tenantId,
      name: "Tenant admin"
    };
    const dataSource = createSessionDataSource(actor, adminProfile, {
      async listWorkspaceUsers() {
        return [];
      },
      async listAccessProfilesByTenantId() {
        return [];
      },
      async listCustomFieldDefinitions() {
        return [];
      }
    });
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/workspace/admin/read-model", {
      headers: { cookie }
    });

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "persistence_not_configured" });
  });
});
