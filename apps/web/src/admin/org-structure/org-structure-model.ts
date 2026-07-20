/* ============================================================
   Чистая модель редактора оргструктуры (без React/DOM) — тестируемая
   отдельно. Держит редактируемый черновик двух треков и сериализует
   его в тело PUT /api/tenant/current/org-structure (full-replace).

   Дерево — ДВА уровня на трек: направление → единица
   (отдел для functional, команда для project). Должность в дереве не
   узел — она приходит из справочника позиций и попадает в расстановку.
   Ограничения зеркалят серверный валидатор
   (@kiss-pm/tenant-org-structure/validation): направление без родителя,
   единица под направлением, расстановка требует направление+единицу.
   ============================================================ */

import type {
  OrgNodeType,
  OrgStructureReplaceBody,
  OrgStructureSnapshot,
  OrgStructureTrack,
  OrgTrackInput,
  OrgTrackSnapshot
} from "./org-structure-client";

export type EditUnit = { id: string; name: string };
export type EditDirection = { id: string; name: string; units: EditUnit[] };
// unitId/positionId пустые ("") = расстановка неполная (в PUT не попадёт).
export type EditPlacement = { userId: string; directionId: string; unitId: string; positionId: string };
export type EditTrack = { directions: EditDirection[]; placements: EditPlacement[] };
export type EditModel = { functional: EditTrack; project: EditTrack };

export const NODE_ID_MAX = 120;
// Серверный parseOrgStructureName: 1..160 символов без управляющих байтов.
export const NODE_NAME_MAX = 160;

export function unitNodeType(track: OrgStructureTrack): Exclude<OrgNodeType, "direction"> {
  return track === "functional" ? "department" : "team";
}

export function unitNounNominative(track: OrgStructureTrack): string {
  return track === "functional" ? "отдел" : "команда";
}

export function unitNounAccusative(track: OrgStructureTrack): string {
  return track === "functional" ? "отдел" : "команду";
}

// Генерация id узла: серверный parseOrgStructureId требует ^[a-z0-9][a-z0-9_-]{2,119}$.
export function newNodeId(prefix: "dir" | "dep" | "team"): string {
  const c: Crypto | undefined = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  const raw =
    c && typeof c.randomUUID === "function"
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${raw}`.slice(0, NODE_ID_MAX);
}

// Черновик трека из серверного снапшота. Единицы фильтруются по типу трека и
// принадлежности направлению; расстановки берутся как есть (unitId = department|team).
export function buildEditTrack(snapshot: OrgTrackSnapshot, track: OrgStructureTrack): EditTrack {
  const unitType = unitNodeType(track);
  const directions = snapshot.nodes
    .filter((node) => node.nodeType === "direction")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"))
    .map<EditDirection>((direction) => ({
      id: direction.id,
      name: direction.name,
      units: snapshot.nodes
        .filter((node) => node.nodeType === unitType && node.parentId === direction.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"))
        .map<EditUnit>((unit) => ({ id: unit.id, name: unit.name }))
    }));

  const placements = snapshot.placements.map<EditPlacement>((placement) => ({
    userId: placement.userId,
    directionId: placement.directionId,
    unitId: (track === "functional" ? placement.departmentId : placement.teamId) ?? "",
    positionId: placement.positionId
  }));

  return { directions, placements };
}

export function buildEditModel(snapshot: OrgStructureSnapshot): EditModel {
  return {
    functional: buildEditTrack(snapshot.functional, "functional"),
    project: buildEditTrack(snapshot.project, "project")
  };
}

export function emptyEditModel(): EditModel {
  return {
    functional: { directions: [], placements: [] },
    project: { directions: [], placements: [] }
  };
}

// Полная ли расстановка: направление, его единица и должность заданы, единица принадлежит направлению.
export function isPlacementComplete(placement: EditPlacement, track: EditTrack): boolean {
  if (!placement.directionId || !placement.unitId || !placement.positionId) return false;
  const direction = track.directions.find((d) => d.id === placement.directionId);
  if (!direction) return false;
  return direction.units.some((unit) => unit.id === placement.unitId);
}

export function serializeTrack(track: EditTrack, trackType: OrgStructureTrack): OrgTrackInput {
  const unitType = unitNodeType(trackType);
  const nodes: OrgTrackInput["nodes"] = [];
  track.directions.forEach((direction, directionIndex) => {
    nodes.push({
      id: direction.id,
      nodeType: "direction",
      name: direction.name.trim(),
      parentId: null,
      sortOrder: directionIndex
    });
    direction.units.forEach((unit, unitIndex) => {
      nodes.push({
        id: unit.id,
        nodeType: unitType,
        name: unit.name.trim(),
        parentId: direction.id,
        sortOrder: unitIndex
      });
    });
  });

  // В PUT попадают только ПОЛНЫЕ расстановки (честно: частичный выбор не сохраняем).
  const placements: OrgTrackInput["placements"] = [];
  const seenUsers = new Set<string>();
  for (const placement of track.placements) {
    if (!isPlacementComplete(placement, track)) continue;
    if (seenUsers.has(placement.userId)) continue;
    seenUsers.add(placement.userId);
    placements.push({
      userId: placement.userId,
      directionId: placement.directionId,
      positionId: placement.positionId,
      ...(trackType === "functional" ? { departmentId: placement.unitId } : { teamId: placement.unitId })
    });
  }

  return { nodes, placements };
}

export function serializeModel(model: EditModel): OrgStructureReplaceBody {
  return {
    functional: serializeTrack(model.functional, "functional"),
    project: serializeTrack(model.project, "project")
  };
}

// Стабильный отпечаток модели для детекта «есть несохранённые изменения».
export function modelFingerprint(model: EditModel): string {
  return JSON.stringify(serializeModel(model));
}

export type NameCheck = { ok: true; value: string } | { ok: false; reason: string };

export function checkNodeName(raw: string): NameCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "Введите название" };
  if (value.length > NODE_NAME_MAX) return { ok: false, reason: `Название длиннее ${NODE_NAME_MAX} символов` };
  if (hasControlChars(value)) return { ok: false, reason: "Название содержит управляющие символы" };
  return { ok: true, value };
}

// Управляющие байты 0x00..0x1f и 0x7f (зеркало серверного parseOrgStructureName).
function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}
