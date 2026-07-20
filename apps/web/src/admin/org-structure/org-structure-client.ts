/* ============================================================
   Org-structure API client — тонкий типизированный клиент над боевыми
   ручками оргструктуры тенанта:
     GET  /api/tenant/current/org-structure  (canReadOrgStructure)
     PUT  /api/tenant/current/org-structure  (canManageOrgStructure, full-replace)
     GET  /api/workspace/users               (справочник людей для расстановки)
     GET  /api/workspace/positions           (справочник должностей)

   Зеркало createAdminClient/createCrmClient: тот же приём с инъекцией
   fetchImpl (contract-mock в тестах/сторибуке) и теми же заголовками
   same-origin. Типы — локальная копия формы серверного снапшота
   (apps/api/src/orgStructureRoutes.ts + @kiss-pm/tenant-org-structure),
   чтобы web не зависел от пакета персистентности.
   ============================================================ */

import { createRequestJson, type DomainClientOptions } from "../../lib/domain-client";

export type OrgStructureTrack = "functional" | "project";
export type OrgNodeType = "direction" | "department" | "team";

// Узел дерева: направление (parentId=null) или единица (отдел/команда, parentId=направление).
export type OrgNode = {
  id: string;
  tenantId: string;
  track: OrgStructureTrack;
  nodeType: OrgNodeType;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

// Расстановка человека: направление + единица (departmentId для functional, teamId для project) + должность.
export type OrgPlacement = {
  tenantId: string;
  userId: string;
  track: OrgStructureTrack;
  directionId: string;
  departmentId: string | null;
  teamId: string | null;
  positionId: string;
};

export type OrgTrackSnapshot = { nodes: OrgNode[]; placements: OrgPlacement[] };
export type OrgStructureSnapshot = { functional: OrgTrackSnapshot; project: OrgTrackSnapshot };

// Тело PUT (full-replace). departmentId/teamId — по треку (см. серверный parseTrackInput).
export type OrgNodeInput = {
  id: string;
  nodeType: OrgNodeType;
  name: string;
  parentId: string | null;
  sortOrder: number;
};
export type OrgPlacementInput = {
  userId: string;
  directionId: string;
  departmentId?: string | null;
  teamId?: string | null;
  positionId: string;
};
export type OrgTrackInput = { nodes: OrgNodeInput[]; placements: OrgPlacementInput[] };
export type OrgStructureReplaceBody = { functional: OrgTrackInput; project: OrgTrackInput };

// Справочник людей рабочей области (подмножество боевого WorkspaceUser).
export type OrgWorkspaceUser = {
  id: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
};
// Должность (боевой PositionRecord).
export type OrgPosition = { id: string; name: string };

export function createOrgStructureClient(options: DomainClientOptions) {
  const requestJson = createRequestJson(options);
  return {
    getOrgStructure() {
      return requestJson<{ orgStructure: OrgStructureSnapshot }>("/api/tenant/current/org-structure");
    },
    replaceOrgStructure(body: OrgStructureReplaceBody) {
      return requestJson<{ orgStructure: OrgStructureSnapshot }>("/api/tenant/current/org-structure", {
        method: "PUT",
        body: JSON.stringify(body)
      });
    },
    listUsers() {
      return requestJson<{ users: OrgWorkspaceUser[] }>("/api/workspace/users");
    },
    listPositions() {
      return requestJson<{ positions: OrgPosition[] }>("/api/workspace/positions");
    }
  };
}

export type OrgStructureClient = ReturnType<typeof createOrgStructureClient>;
