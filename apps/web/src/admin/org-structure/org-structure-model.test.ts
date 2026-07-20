import { describe, expect, it } from "vitest";

import type { OrgStructureSnapshot } from "./org-structure-client";
import {
  buildEditModel,
  checkNodeName,
  isPlacementComplete,
  modelFingerprint,
  serializeModel,
  serializeTrack,
  type EditTrack
} from "./org-structure-model";

const TENANT = "tenant-alpha";

// Снапшот с обоими треками: functional (направление→отдел), project (направление→команда).
function sampleSnapshot(): OrgStructureSnapshot {
  return {
    functional: {
      nodes: [
        { id: "dir-eng", tenantId: TENANT, track: "functional", nodeType: "direction", name: "Инженерия", parentId: null, sortOrder: 0 },
        { id: "dep-web", tenantId: TENANT, track: "functional", nodeType: "department", name: "Веб", parentId: "dir-eng", sortOrder: 0 }
      ],
      placements: [
        { tenantId: TENANT, userId: "user-a", track: "functional", directionId: "dir-eng", departmentId: "dep-web", teamId: null, positionId: "position-lead" }
      ]
    },
    project: {
      nodes: [
        { id: "dir-x", tenantId: TENANT, track: "project", nodeType: "direction", name: "Проект X", parentId: null, sortOrder: 0 },
        { id: "team-1", tenantId: TENANT, track: "project", nodeType: "team", name: "Команда 1", parentId: "dir-x", sortOrder: 0 }
      ],
      placements: [
        { tenantId: TENANT, userId: "user-b", track: "project", directionId: "dir-x", departmentId: null, teamId: "team-1", positionId: "position-eng" }
      ]
    }
  };
}

describe("buildEditModel", () => {
  it("строит черновик обоих треков: единицы под направлениями, unitId = department|team", () => {
    const model = buildEditModel(sampleSnapshot());

    expect(model.functional.directions).toHaveLength(1);
    expect(model.functional.directions[0]!.units).toEqual([{ id: "dep-web", name: "Веб" }]);
    expect(model.functional.placements[0]).toEqual({
      userId: "user-a",
      directionId: "dir-eng",
      unitId: "dep-web",
      positionId: "position-lead"
    });

    expect(model.project.directions[0]!.units).toEqual([{ id: "team-1", name: "Команда 1" }]);
    expect(model.project.placements[0]!.unitId).toBe("team-1");
  });
});

describe("serializeTrack / serializeModel", () => {
  it("сериализует направления+единицы в узлы с parentId и sortOrder", () => {
    const model = buildEditModel(sampleSnapshot());
    const functional = serializeTrack(model.functional, "functional");

    expect(functional.nodes).toEqual([
      { id: "dir-eng", nodeType: "direction", name: "Инженерия", parentId: null, sortOrder: 0 },
      { id: "dep-web", nodeType: "department", name: "Веб", parentId: "dir-eng", sortOrder: 0 }
    ]);
    // functional → departmentId, без teamId
    expect(functional.placements).toEqual([
      { userId: "user-a", directionId: "dir-eng", positionId: "position-lead", departmentId: "dep-web" }
    ]);

    const project = serializeTrack(model.project, "project");
    expect(project.placements[0]).toMatchObject({ teamId: "team-1" });
    expect(project.placements[0]).not.toHaveProperty("departmentId");
  });

  it("исключает НЕПОЛНЫЕ расстановки (нет единицы/должности) из тела PUT", () => {
    const track: EditTrack = {
      directions: [{ id: "dir-1", name: "Дир", units: [{ id: "dep-1", name: "Отдел" }] }],
      placements: [
        { userId: "full", directionId: "dir-1", unitId: "dep-1", positionId: "pos-1" },
        { userId: "no-unit", directionId: "dir-1", unitId: "", positionId: "pos-1" },
        { userId: "no-position", directionId: "dir-1", unitId: "dep-1", positionId: "" }
      ]
    };
    const out = serializeTrack(track, "functional");
    expect(out.placements.map((p) => p.userId)).toEqual(["full"]);
  });

  it("исключает расстановку на единицу чужого направления", () => {
    const track: EditTrack = {
      directions: [
        { id: "dir-1", name: "A", units: [{ id: "dep-1", name: "U1" }] },
        { id: "dir-2", name: "B", units: [{ id: "dep-2", name: "U2" }] }
      ],
      placements: [{ userId: "u", directionId: "dir-1", unitId: "dep-2", positionId: "pos" }]
    };
    expect(serializeTrack(track, "functional").placements).toHaveLength(0);
  });

  it("round-trip snapshot→model→body сохраняет полные расстановки обоих треков", () => {
    const body = serializeModel(buildEditModel(sampleSnapshot()));
    expect(body.functional.placements).toHaveLength(1);
    expect(body.project.placements).toHaveLength(1);
  });
});

describe("isPlacementComplete", () => {
  const track: EditTrack = {
    directions: [{ id: "dir-1", name: "Дир", units: [{ id: "dep-1", name: "Отдел" }] }],
    placements: []
  };
  it("true только когда направление, его единица и должность заданы", () => {
    expect(isPlacementComplete({ userId: "u", directionId: "dir-1", unitId: "dep-1", positionId: "p" }, track)).toBe(true);
    expect(isPlacementComplete({ userId: "u", directionId: "dir-1", unitId: "", positionId: "p" }, track)).toBe(false);
    expect(isPlacementComplete({ userId: "u", directionId: "dir-1", unitId: "dep-9", positionId: "p" }, track)).toBe(false);
  });
});

describe("modelFingerprint", () => {
  it("меняется при правке черновика (детект несохранённых изменений)", () => {
    const model = buildEditModel(sampleSnapshot());
    const before = modelFingerprint(model);
    model.functional.directions[0]!.name = "Инженерия+";
    expect(modelFingerprint(model)).not.toBe(before);
  });
});

describe("checkNodeName", () => {
  it("отклоняет пустое, слишком длинное и управляющие символы", () => {
    expect(checkNodeName("  ").ok).toBe(false);
    expect(checkNodeName("x".repeat(161)).ok).toBe(false);
    expect(checkNodeName(`ok${String.fromCharCode(7)}bad`).ok).toBe(false);
    const ok = checkNodeName("  Разработка  ");
    expect(ok).toEqual({ ok: true, value: "Разработка" });
  });
});
