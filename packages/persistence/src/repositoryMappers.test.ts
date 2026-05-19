import { describe, expect, it } from "vitest";

import {
  mapAccessProfileRecord,
  mapCustomFieldDefinitionRecord,
  mapPositionRecord,
  mapProjectTemplateRecord,
  mapTenantUser,
  mapWorkspaceUserRecord,
  toPermission
} from "./repositoryMappers";
import type { tenantUsers } from "./schema";

describe("repository row mappers", () => {
  it("maps persisted tenant users to the domain tenant user shape", () => {
    expect(mapTenantUser(tenantUserRow())).toEqual({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: "tenant-admin"
    });
  });

  it("maps access profiles and fails fast on unknown persisted permissions", () => {
    expect(
      mapAccessProfileRecord({
        id: "tenant-admin",
        tenantId: "tenant-alpha",
        name: "Администратор",
        permissions: ["tenant.users.read", "profile.read"],
        createdAt: new Date("2026-05-19T00:00:00.000Z")
      })
    ).toEqual({
      id: "tenant-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: ["tenant.users.read", "profile.read"]
    });

    expect(() => toPermission("legacy.report.admin")).toThrow(
      "Unknown persisted permission: legacy.report.admin"
    );
  });

  it("maps workspace users with joined position names", () => {
    expect(mapWorkspaceUserRecord(tenantUserRow(), "Руководитель проекта")).toEqual({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      accessProfileId: "tenant-admin",
      positionId: "position-pm",
      positionName: "Руководитель проекта",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      phone: "+7",
      telegram: "@anna",
      status: "active",
      theme: "light",
      accentColor: "#2563eb"
    });
  });

  it("maps workspace config rows without changing dates or nullable fields", () => {
    const createdAt = new Date("2026-05-19T01:00:00.000Z");
    const updatedAt = new Date("2026-05-19T02:00:00.000Z");

    expect(
      mapCustomFieldDefinitionRecord({
        id: "field-project-priority",
        tenantId: "tenant-alpha",
        systemKey: "project_priority",
        tenantLabel: "Приоритет проекта",
        targetEntity: "project",
        fieldType: "select",
        required: true,
        status: "active",
        createdAt,
        updatedAt
      })
    ).toEqual({
      id: "field-project-priority",
      tenantId: "tenant-alpha",
      systemKey: "project_priority",
      tenantLabel: "Приоритет проекта",
      targetEntity: "project",
      fieldType: "select",
      required: true,
      status: "active",
      createdAt,
      updatedAt
    });

    expect(
      mapProjectTemplateRecord({
        id: "template-implementation",
        tenantId: "tenant-alpha",
        systemKey: "implementation",
        tenantLabel: "Внедрение",
        description: null,
        status: "draft",
        createdAt,
        updatedAt
      })
    ).toEqual({
      id: "template-implementation",
      tenantId: "tenant-alpha",
      systemKey: "implementation",
      tenantLabel: "Внедрение",
      description: null,
      status: "draft",
      createdAt,
      updatedAt
    });
  });

  it("maps positions including nullable descriptions", () => {
    expect(
      mapPositionRecord({
        id: "position-pm",
        tenantId: "tenant-alpha",
        name: "Руководитель проекта",
        description: null,
        createdAt: new Date("2026-05-19T00:00:00.000Z")
      })
    ).toEqual({
      id: "position-pm",
      tenantId: "tenant-alpha",
      name: "Руководитель проекта",
      description: null
    });
  });
});

function tenantUserRow(): typeof tenantUsers.$inferSelect {
  return {
    id: "user-alpha-admin",
    tenantId: "tenant-alpha",
    accessProfileId: "tenant-admin",
    positionId: "position-pm",
    email: "admin@kiss-pm.local",
    name: "Анна Администратор",
    phone: "+7",
    telegram: "@anna",
    status: "active",
    theme: "light",
    accentColor: "#2563eb",
    createdAt: new Date("2026-05-19T00:00:00.000Z")
  };
}
