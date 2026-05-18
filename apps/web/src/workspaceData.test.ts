import { describe, expect, it } from "vitest";

import { buildWorkspaceData } from "./workspaceData";

const me = {
  id: "user-1",
  tenantId: "tenant-1",
  email: "admin@kiss-pm.local",
  name: "Админ",
  accessProfileId: "role-1",
  positionId: null,
  positionName: null,
  phone: null,
  telegram: null,
  status: "active",
  theme: "light",
  accentColor: "#0f766e"
};

describe("workspace data derivation", () => {
  it("does not expose cached resource data when the current permission is missing", () => {
    const data = buildWorkspaceData({
      apiStatus: "ok",
      me,
      permissions: ["profile.read"],
      users: { users: [{ ...me, id: "stale-user" }] },
      positions: {
        positions: [{ id: "position-1", tenantId: "tenant-1", name: "Stale", description: null }]
      },
      accessRoles: {
        accessRoles: [{ id: "role-1", tenantId: "tenant-1", name: "Stale", permissions: [] }]
      },
      auditEvents: {
        auditEvents: [
          {
            id: "audit-1",
            tenantId: "tenant-1",
            actorUserId: "user-1",
            actionType: "stale",
            correlationId: "corr-1",
            createdAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      customFields: {
        customFields: [
          {
            id: "field-1",
            tenantId: "tenant-1",
            systemKey: "priority",
            tenantLabel: "Приоритет",
            targetEntity: "project",
            fieldType: "select",
            required: false,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      },
      projectTemplates: {
        projectTemplates: [
          {
            id: "template-1",
            tenantId: "tenant-1",
            systemKey: "implementation",
            tenantLabel: "Внедрение",
            description: null,
            status: "active",
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      }
    });

    expect(data.users).toEqual([]);
    expect(data.positions).toEqual([]);
    expect(data.accessRoles).toEqual([]);
    expect(data.auditEvents).toEqual([]);
    expect(data.customFields).toEqual([]);
    expect(data.projectTemplates).toEqual([]);
  });
});
