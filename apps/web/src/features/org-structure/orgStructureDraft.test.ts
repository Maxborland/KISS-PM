import { describe, expect, it } from "vitest";

import { removeOrgNode, reparentOrgUnit } from "./orgStructureDraft";

const baseSnapshot = {
  nodes: [
    {
      id: "dir-1",
      tenantId: "t1",
      track: "functional" as const,
      nodeType: "direction" as const,
      name: "Инженерия",
      parentId: null,
      sortOrder: 0
    },
    {
      id: "dept-1",
      tenantId: "t1",
      track: "functional" as const,
      nodeType: "department" as const,
      name: "Backend",
      parentId: "dir-1",
      sortOrder: 0
    }
  ],
  placements: [
    {
      tenantId: "t1",
      userId: "u1",
      track: "functional" as const,
      directionId: "dir-1",
      departmentId: "dept-1",
      teamId: null,
      positionId: "pos-1"
    }
  ]
};

describe("orgStructureDraft", () => {
  it("removes direction with children and related placements", () => {
    const next = removeOrgNode(baseSnapshot, "functional", "dir-1");
    expect(next.nodes).toHaveLength(0);
    expect(next.placements).toHaveLength(0);
  });

  it("reparents unit and clears placement unit when direction changes", () => {
    const withSecondDir = {
      ...baseSnapshot,
      nodes: [
        ...baseSnapshot.nodes,
        {
          id: "dir-2",
          tenantId: "t1",
          track: "functional" as const,
          nodeType: "direction" as const,
          name: "Продажи",
          parentId: null,
          sortOrder: 1
        }
      ]
    };
    const next = reparentOrgUnit(withSecondDir, "dept-1", "dir-2");
    expect(next.nodes.find((node) => node.id === "dept-1")?.parentId).toBe("dir-2");
    expect(next.placements[0]?.directionId).toBe("dir-2");
    expect(next.placements[0]?.departmentId).toBeNull();
  });
});
