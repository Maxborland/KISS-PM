import { describe, expect, it } from "vitest";

import {
  buildLinkPreviewLine,
  canCompleteLinkHover,
  isGanttDependencyEndpoint,
  linkPreviewDependencyType,
  linkReadoutLabel,
  linkTargetFromHitAttrs,
  linkTargetFromPointer
} from "./gantt-link-interaction";
import type { GanttRow } from "./types";

const row = (id: string, startDay: number, durationDays = 2): GanttRow => ({
  id,
  level: 1,
  kind: "task",
  name: id,
  startDay,
  durationDays
});

describe("linkTargetFromHitAttrs", () => {
  it("maps valid endpoint attributes", () => {
    expect(linkTargetFromHitAttrs({ rowId: "t1", endpoint: "finish" })).toEqual({
      rowId: "t1",
      endpoint: "finish"
    });
  });

  it("rejects invalid endpoint", () => {
    expect(linkTargetFromHitAttrs({ rowId: "t1", endpoint: "middle" })).toBeUndefined();
    expect(linkTargetFromHitAttrs({ rowId: null, endpoint: "start" })).toBeUndefined();
  });
});

describe("linkTargetFromPointer", () => {
  it("resolves target from elementFromPoint adapter", () => {
    const handle = {
      getAttribute: (name: string) =>
        name === "data-gantt-row-id" ? "b" : name === "data-gantt-endpoint" ? "start" : null,
      closest: () => handle
    };
    const doc = {
      elementFromPoint: () => handle
    } as unknown as Document;

    expect(linkTargetFromPointer(10, 20, doc)).toEqual({ rowId: "b", endpoint: "start" });
  });
});

describe("link preview readout", () => {
  it("derives FS type and Russian label", () => {
    const type = linkPreviewDependencyType("finish", { endpoint: "start" });
    expect(type).toBe("FS");
    expect(linkReadoutLabel(type)).toBe("Связь: FS");
  });

  it("returns null label without hover endpoint", () => {
    expect(linkPreviewDependencyType("finish", undefined)).toBeNull();
    expect(linkReadoutLabel(null)).toBeNull();
  });
});

describe("canCompleteLinkHover", () => {
  it("allows hover on a different row", () => {
    expect(canCompleteLinkHover("a", { rowId: "b", endpoint: "start" })).toBe(true);
    expect(canCompleteLinkHover("a", { rowId: "a", endpoint: "finish" })).toBe(false);
  });
});

describe("buildLinkPreviewLine", () => {
  it("anchors preview to source bar endpoint", () => {
    const rows = [row("a", 0), row("b", 4)];
    const line = buildLinkPreviewLine({
      rows,
      link: { fromId: "a", fromEndpoint: "finish", pointerX: 200, pointerY: 80 },
      dayW: 20
    });
    expect(line).toEqual({ x1: 40, y1: 60, x2: 200, y2: 80 });
  });

  it("snaps preview end to hovered target endpoint", () => {
    const rows = [row("a", 0), row("b", 4)];
    const line = buildLinkPreviewLine({
      rows,
      link: {
        fromId: "a",
        fromEndpoint: "finish",
        pointerX: 1,
        pointerY: 1,
        hoverToId: "b",
        hoverToEndpoint: "start"
      },
      dayW: 20
    });
    expect(line?.x2).toBe(80);
    expect(line?.y2).toBe(88);
  });
});

describe("isGanttDependencyEndpoint", () => {
  it("narrows endpoint literals", () => {
    expect(isGanttDependencyEndpoint("start")).toBe(true);
    expect(isGanttDependencyEndpoint("finish")).toBe(true);
    expect(isGanttDependencyEndpoint("other")).toBe(false);
  });
});
