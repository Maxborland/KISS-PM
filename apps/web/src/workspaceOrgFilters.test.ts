import { describe, expect, it } from "vitest";

import type { WorkspaceUser } from "./api";
import type { TenantOrgStructureSnapshot } from "./features/org-structure/useOrgStructure";
import { filterUsersByOrgPlacement } from "./workspaceOrgFilters";

const users: WorkspaceUser[] = [
  {
    id: "u1",
    tenantId: "t1",
    accessProfileId: "role-1",
    email: "a@test",
    name: "Алиса",
    phone: null,
    telegram: null,
    positionId: "pos-1",
    positionName: "Dev",
    status: "active",
    theme: "light",
    accentColor: "#0f172a"
  },
  {
    id: "u2",
    tenantId: "t1",
    accessProfileId: "role-1",
    email: "b@test",
    name: "Борис",
    phone: null,
    telegram: null,
    positionId: null,
    positionName: null,
    status: "active",
    theme: "light",
    accentColor: "#0f172a"
  }
];

const orgStructure: TenantOrgStructureSnapshot = {
  functional: {
    nodes: [
      {
        id: "dir-1",
        tenantId: "t1",
        track: "functional",
        nodeType: "direction",
        name: "Инженерия",
        parentId: null,
        sortOrder: 0
      },
      {
        id: "dept-1",
        tenantId: "t1",
        track: "functional",
        nodeType: "department",
        name: "Backend",
        parentId: "dir-1",
        sortOrder: 0
      }
    ],
    placements: [
      {
        tenantId: "t1",
        userId: "u1",
        track: "functional",
        directionId: "dir-1",
        departmentId: "dept-1",
        teamId: null,
        positionId: "pos-1"
      }
    ]
  },
  project: { nodes: [], placements: [] }
};

describe("filterUsersByOrgPlacement", () => {
  it("filters by direction and unit", () => {
    const filtered = filterUsersByOrgPlacement(users, orgStructure, {
      track: "functional",
      directionId: "dir-1",
      unitId: "dept-1",
      unplacedOnly: false
    });
    expect(filtered.map((user) => user.id)).toEqual(["u1"]);
  });

  it("shows only users without placement", () => {
    const filtered = filterUsersByOrgPlacement(users, orgStructure, {
      track: "functional",
      directionId: "",
      unitId: "",
      unplacedOnly: true
    });
    expect(filtered.map((user) => user.id)).toEqual(["u2"]);
  });
});
