import { describe, expect, it } from "vitest";

import { validateOrgStructureReplace } from "./validation";

describe("validateOrgStructureReplace", () => {
  it("rejects duplicate userId in the same track", () => {
    const error = validateOrgStructureReplace({
      functional: {
        nodes: [
          { id: "dir-1", nodeType: "direction", name: "A", parentId: null, sortOrder: 0 },
          { id: "dept-1", nodeType: "department", name: "B", parentId: "dir-1", sortOrder: 0 }
        ],
        placements: [
          {
            userId: "u1",
            directionId: "dir-1",
            departmentId: "dept-1",
            positionId: "pos-1"
          },
          {
            userId: "u1",
            directionId: "dir-1",
            departmentId: "dept-1",
            positionId: "pos-1"
          }
        ]
      },
      project: { nodes: [], placements: [] }
    });
    expect(error).toBe("tenant_org_placement_duplicate_user");
  });

  it("rejects department not under selected direction", () => {
    const error = validateOrgStructureReplace({
      functional: {
        nodes: [
          { id: "dir-1", nodeType: "direction", name: "A", parentId: null, sortOrder: 0 },
          { id: "dir-2", nodeType: "direction", name: "C", parentId: null, sortOrder: 1 },
          { id: "dept-2", nodeType: "department", name: "D", parentId: "dir-2", sortOrder: 0 }
        ],
        placements: [
          {
            userId: "u1",
            directionId: "dir-1",
            departmentId: "dept-2",
            positionId: "pos-1"
          }
        ]
      },
      project: { nodes: [], placements: [] }
    });
    expect(error).toBe("tenant_org_placement_invalid_department");
  });

  it("rejects unit parented to another unit", () => {
    const error = validateOrgStructureReplace({
      functional: {
        nodes: [
          { id: "dir-1", nodeType: "direction", name: "A", parentId: null, sortOrder: 0 },
          { id: "dept-1", nodeType: "department", name: "B", parentId: "dir-1", sortOrder: 0 },
          { id: "dept-2", nodeType: "department", name: "C", parentId: "dept-1", sortOrder: 1 }
        ],
        placements: []
      },
      project: { nodes: [], placements: [] }
    });
    expect(error).toBe("tenant_org_node_invalid_parent");
  });

  it("rejects duplicate node id across tracks", () => {
    const error = validateOrgStructureReplace({
      functional: {
        nodes: [{ id: "dir-1", nodeType: "direction", name: "A", parentId: null, sortOrder: 0 }],
        placements: []
      },
      project: {
        nodes: [{ id: "dir-1", nodeType: "direction", name: "B", parentId: null, sortOrder: 0 }],
        placements: []
      }
    });
    expect(error).toBe("tenant_org_node_duplicate_id");
  });
});
