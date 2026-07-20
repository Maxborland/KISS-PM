/* ============================================================
   Contract-mock оргструктуры для Storybook/тестов (не боевой сервер).
   Реализует форму боевого контракта GET/PUT
   /api/tenant/current/org-structure + справочники users/positions,
   держит состояние в памяти сессии (full-replace на PUT). Компонент
   работает через настоящий createOrgStructureClient(fetchImpl), поэтому
   переключение на live — смена apiOrigin, не кода UI.
   ============================================================ */

import type {
  OrgPosition,
  OrgStructureReplaceBody,
  OrgStructureSnapshot,
  OrgTrackInput,
  OrgTrackSnapshot,
  OrgWorkspaceUser
} from "./org-structure-client";

const TENANT_ID = "tenant-mock";

const USERS: OrgWorkspaceUser[] = [
  { id: "user-petrov", name: "Петров А.", positionId: "position-lead", positionName: "Тимлид" },
  { id: "user-ivanova", name: "Иванова М.", positionId: "position-designer", positionName: "Дизайнер" },
  { id: "user-sergeev", name: "Сергеев П.", positionId: "position-engineer", positionName: "Инженер" }
];

const POSITIONS: OrgPosition[] = [
  { id: "position-lead", name: "Тимлид" },
  { id: "position-designer", name: "Дизайнер" },
  { id: "position-engineer", name: "Инженер" }
];

function emptyTrackSnapshot(): OrgTrackSnapshot {
  return { nodes: [], placements: [] };
}

function materializeTrack(
  input: OrgTrackInput,
  track: "functional" | "project"
): OrgTrackSnapshot {
  return {
    nodes: input.nodes.map((node) => ({ ...node, tenantId: TENANT_ID, track })),
    placements: input.placements.map((placement) => ({
      tenantId: TENANT_ID,
      userId: placement.userId,
      track,
      directionId: placement.directionId,
      departmentId: placement.departmentId ?? null,
      teamId: placement.teamId ?? null,
      positionId: placement.positionId
    }))
  };
}

export function createMockOrgStructureFetch(): typeof fetch {
  let snapshot: OrgStructureSnapshot = {
    functional: emptyTrackSnapshot(),
    project: emptyTrackSnapshot()
  };

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/api/tenant/current/org-structure")) {
      if (method === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}")) as OrgStructureReplaceBody;
        snapshot = {
          functional: materializeTrack(body.functional, "functional"),
          project: materializeTrack(body.project, "project")
        };
        return json({ orgStructure: snapshot });
      }
      return json({ orgStructure: snapshot });
    }
    if (url.includes("/api/workspace/users")) return json({ users: USERS });
    if (url.includes("/api/workspace/positions")) return json({ positions: POSITIONS });

    return json({ error: "not_found" }, 404);
  };
}
