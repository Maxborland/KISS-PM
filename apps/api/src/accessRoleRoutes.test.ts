import { createAccessProfile } from "@kiss-pm/access-control";
import type { TenantUser, UserId } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import { createApp } from "./app";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  WorkspaceUserRecord
} from "./apiTypes";

type CapturedAuditEvent = Parameters<
  NonNullable<ApiTenantDataSource["appendAuditEvent"]>
>[0];

const cookie =
  "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const mutationHeaders = {
  cookie,
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

describe("access role routes", () => {
  it("updates CRM write permission audibly and revokes sessions for users on the changed role", async () => {
    const auditEvents: CapturedAuditEvent[] = [];
    const revokedSessions: Array<{ tenantId: string; userId: UserId }> = [];
    const editableRole: AccessProfileRecord = {
      ...createAccessProfile({
      id: "sales-editor",
      permissions: ["tenant.opportunities.read"]
      }),
      tenantId: "tenant-alpha",
      name: "CRM читатель"
    };
    const adminRole: AccessProfileRecord = {
      ...createAccessProfile({
      id: "tenant-admin",
      permissions: [
        "tenant.access_profiles.read",
        "tenant.access_profiles.manage",
        "tenant.users.read"
      ]
      }),
      tenantId: "tenant-alpha",
      name: "Администратор"
    };
    let roles: AccessProfileRecord[] = [adminRole, editableRole];

    const adminUser: TenantUser = {
      id: "user-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      accessProfileId: "tenant-admin"
    };
    const adminWorkspaceUser: WorkspaceUserRecord = {
      id: "user-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Администратор",
      accessProfileId: "tenant-admin",
      positionId: null,
      positionName: null,
      phone: null,
      telegram: null,
      status: "active",
      theme: "light",
      accentColor: "teal"
    };
    const roleUser: WorkspaceUserRecord = {
      id: "user-sales",
      tenantId: "tenant-alpha",
      email: "sales@kiss-pm.local",
      name: "Менеджер CRM",
      accessProfileId: "sales-editor",
      positionId: null,
      positionName: null,
      phone: null,
      telegram: null,
      status: "active",
      theme: "light",
      accentColor: "teal"
    };
    const otherUser: WorkspaceUserRecord = {
      ...roleUser,
      id: "user-other",
      email: "other@kiss-pm.local",
      name: "Наблюдатель",
      accessProfileId: "tenant-admin"
    };

    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        return {
          id: "session-admin",
          tenantId: "tenant-alpha",
          userId: "user-admin",
          tokenHash: "ignored",
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === adminUser.id ? adminUser : undefined;
      },
      async findAccessProfileById(_tenantId, accessProfileId) {
        return roles.find((role) => role.id === accessProfileId);
      },
      async listUsersByTenantId() {
        return [adminUser];
      },
      async listAccessProfilesByTenantId() {
        return roles;
      },
      async listWorkspaceUsers() {
        return [adminWorkspaceUser, roleUser, otherUser];
      },
      async updateAccessProfile(input) {
        roles = roles.map((role) => (role.id === input.id ? input : role));
        return roles.find((role) => role.id === input.id)!;
      },
      async deleteSessionsByUserId(tenantId, userId) {
        revokedSessions.push({ tenantId, userId });
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent(input) {
        auditEvents.push(input);
      }
    };

    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
    const response = await app.request("/api/workspace/access-roles/sales-editor", {
      method: "PATCH",
      headers: mutationHeaders,
      body: JSON.stringify({
        name: "CRM редактор",
        permissions: ["tenant.opportunities.read", "tenant.opportunities.manage"]
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accessRole: {
        id: "sales-editor",
        tenantId: "tenant-alpha",
        name: "CRM редактор",
        permissions: ["tenant.opportunities.read", "tenant.opportunities.manage"]
      }
    });
    expect(revokedSessions).toEqual([
      { tenantId: "tenant-alpha", userId: "user-sales" }
    ]);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actionType: "tenant.access_profile.updated",
      sourceWorkflow: "single_workspace_access_roles",
      sourceEntity: { type: "AccessProfile", id: "sales-editor" },
      beforeState: {
        id: "sales-editor",
        permissions: ["tenant.opportunities.read"]
      },
      afterState: {
        id: "sales-editor",
        permissions: ["tenant.opportunities.read", "tenant.opportunities.manage"]
      },
      executionResult: {
        affectedSessionUserIds: ["user-sales"],
        privilegeChanged: true
      }
    });
  });

  it("rejects unknown CRM write permission keys without changing role sessions", async () => {
    const auditEvents: CapturedAuditEvent[] = [];
    const revokedSessions: Array<{ tenantId: string; userId: UserId }> = [];
    const roles: AccessProfileRecord[] = [
      {
        ...createAccessProfile({
          id: "tenant-admin",
          permissions: [
            "tenant.access_profiles.read",
            "tenant.access_profiles.manage"
          ]
        }),
        tenantId: "tenant-alpha",
        name: "Администратор"
      },
      {
        ...createAccessProfile({
          id: "sales-editor",
          permissions: ["tenant.opportunities.read"]
        }),
        tenantId: "tenant-alpha",
        name: "CRM читатель"
      }
    ];
    const adminUser: TenantUser = {
      id: "user-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      accessProfileId: "tenant-admin"
    };
    const adminWorkspaceUser: WorkspaceUserRecord = {
      id: "user-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Администратор",
      accessProfileId: "tenant-admin",
      positionId: null,
      positionName: null,
      phone: null,
      telegram: null,
      status: "active",
      theme: "light",
      accentColor: "teal"
    };

    const dataSource: Partial<ApiTenantDataSource> = {
      async findSessionByTokenHash() {
        return {
          id: "session-admin",
          tenantId: "tenant-alpha",
          userId: "user-admin",
          tokenHash: "ignored",
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
        };
      },
      async findUserById(userId) {
        return userId === adminUser.id ? adminUser : undefined;
      },
      async findAccessProfileById(_tenantId, accessProfileId) {
        return roles.find((role) => role.id === accessProfileId);
      },
      async listUsersByTenantId() {
        return [adminUser];
      },
      async listAccessProfilesByTenantId() {
        return roles;
      },
      async listWorkspaceUsers() {
        return [adminWorkspaceUser];
      },
      async updateAccessProfile() {
        throw new Error("access profile must not update for invalid permissions");
      },
      async deleteSessionsByUserId(tenantId, userId) {
        revokedSessions.push({ tenantId, userId });
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent(input) {
        auditEvents.push(input);
      }
    };

    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
    const response = await app.request("/api/workspace/access-roles/sales-editor", {
      method: "PATCH",
      headers: mutationHeaders,
      body: JSON.stringify({
        name: "CRM редактор",
        permissions: ["tenant.opportunities.read", "tenant.opportunities.write"]
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_permissions" });
    expect(revokedSessions).toEqual([]);
    expect(auditEvents).toEqual([]);
  });
});
