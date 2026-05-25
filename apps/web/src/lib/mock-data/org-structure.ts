import type { OrgStructureSnapshot } from "@/lib/api-types";

import { MOCK_TENANT_ID } from "./users";

export const MOCK_ORG_STRUCTURE = {
  functional: {
    nodes: [
      {
        id: "func-dir-delivery",
        tenantId: MOCK_TENANT_ID,
        track: "functional",
        nodeType: "direction",
        name: "Delivery",
        parentId: null,
        sortOrder: 10
      },
      {
        id: "func-dept-projects",
        tenantId: MOCK_TENANT_ID,
        track: "functional",
        nodeType: "department",
        name: "Проектный офис",
        parentId: "func-dir-delivery",
        sortOrder: 10
      },
      {
        id: "func-team-implementation",
        tenantId: MOCK_TENANT_ID,
        track: "functional",
        nodeType: "team",
        name: "Внедрение",
        parentId: "func-dept-projects",
        sortOrder: 10
      }
    ],
    placements: [
      {
        tenantId: MOCK_TENANT_ID,
        userId: "usr-ivanova",
        track: "functional",
        directionId: "func-dir-delivery",
        departmentId: "func-dept-projects",
        teamId: "func-team-implementation",
        positionId: "pos-pm"
      },
      {
        tenantId: MOCK_TENANT_ID,
        userId: "usr-petrov",
        track: "functional",
        directionId: "func-dir-delivery",
        departmentId: "func-dept-projects",
        teamId: "func-team-implementation",
        positionId: "pos-arch"
      }
    ]
  },
  project: {
    nodes: [
      {
        id: "proj-dir-portfolio",
        tenantId: MOCK_TENANT_ID,
        track: "project",
        nodeType: "direction",
        name: "Портфель внедрений",
        parentId: null,
        sortOrder: 10
      },
      {
        id: "proj-team-crm",
        tenantId: MOCK_TENANT_ID,
        track: "project",
        nodeType: "team",
        name: "CRM stream",
        parentId: "proj-dir-portfolio",
        sortOrder: 10
      }
    ],
    placements: [
      {
        tenantId: MOCK_TENANT_ID,
        userId: "usr-kozlova",
        track: "project",
        directionId: "proj-dir-portfolio",
        departmentId: null,
        teamId: "proj-team-crm",
        positionId: "pos-design"
      },
      {
        tenantId: MOCK_TENANT_ID,
        userId: "usr-volkov",
        track: "project",
        directionId: "proj-dir-portfolio",
        departmentId: null,
        teamId: "proj-team-crm",
        positionId: "pos-dev"
      }
    ]
  }
} satisfies OrgStructureSnapshot;
