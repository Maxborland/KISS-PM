import { describe, expect, it } from "vitest";

import {
  createTaskRow,
  deleteRow,
  hiddenRowIds,
  indentRow,
  insertTaskBelow,
  moveRow,
  outdentRow,
  renumberWbs,
  toggleRowCollapsed,
  visibleDependencies,
  visibleRows
} from "./gantt-wbs";
import type { GanttDependency, GanttRow } from "./types";

const sample = (): GanttRow[] => [
  { id: "a", level: 0, kind: "summary", name: "A", startDay: 0, durationDays: 10, collapsible: true },
  { id: "b", level: 1, kind: "task", name: "B", startDay: 0, durationDays: 3 },
  { id: "c", level: 1, kind: "task", name: "C", startDay: 3, durationDays: 2 },
  { id: "d", level: 0, kind: "summary", name: "D", startDay: 0, durationDays: 5, collapsible: true, collapsed: true },
  { id: "e", level: 1, kind: "task", name: "E", startDay: 0, durationDays: 1 }
];

const nested = (): GanttRow[] => [
  { id: "root", level: 0, kind: "summary", name: "Root", startDay: 0, durationDays: 20, collapsible: true },
  { id: "p1", level: 1, kind: "summary", name: "Phase 1", startDay: 0, durationDays: 10, collapsible: true, collapsed: true },
  { id: "t1", level: 2, kind: "task", name: "Task 1", startDay: 0, durationDays: 3 },
  { id: "t2", level: 2, kind: "task", name: "Task 2", startDay: 3, durationDays: 2 },
  { id: "p2", level: 1, kind: "summary", name: "Phase 2", startDay: 10, durationDays: 8, collapsible: true },
  { id: "t3", level: 2, kind: "task", name: "Task 3", startDay: 10, durationDays: 4 }
];

describe("renumberWbs", () => {
  it("assigns hierarchical numbers", () => {
    const numbered = renumberWbs(sample());
    expect(numbered[0]?.wbs).toBe("1");
    expect(numbered[1]?.wbs).toBe("1.1");
    expect(numbered[2]?.wbs).toBe("1.2");
  });
});

describe("indent/outdent", () => {
  it("increases level and renumbers", () => {
    const rows = indentRow(sample(), "c");
    expect(rows.find((r) => r.id === "c")?.level).toBe(2);
    expect(rows.find((r) => r.id === "c")?.wbs).toMatch(/^1\./);
  });

  it("decreases level", () => {
    const rows = outdentRow(indentRow(sample(), "b"), "b");
    expect(rows.find((r) => r.id === "b")?.level).toBe(1);
  });

  it("indents a summary row with its descendants", () => {
    const rows = indentRow(nested(), "p1");
    expect(rows.find((row) => row.id === "p1")?.level).toBe(2);
    expect(rows.find((row) => row.id === "t1")?.level).toBe(3);
    expect(rows.find((row) => row.id === "t2")?.level).toBe(3);
    expect(rows.find((row) => row.id === "p2")?.level).toBe(1);
  });

  it("outdents a summary row with its descendants", () => {
    const indented = indentRow(nested(), "p1");
    const rows = outdentRow(indented, "p1");
    expect(rows.find((row) => row.id === "p1")?.level).toBe(1);
    expect(rows.find((row) => row.id === "t1")?.level).toBe(2);
    expect(rows.find((row) => row.id === "t2")?.level).toBe(2);
  });
});

describe("moveRow", () => {
  it("swaps adjacent rows", () => {
    const rows = moveRow(sample(), "b", 1);
    expect(rows[1]?.id).toBe("c");
    expect(rows[2]?.id).toBe("b");
  });

  it("moves a summary row with its descendants", () => {
    const rows = moveRow(nested(), "p1", 1);
    expect(rows.map((row) => row.id)).toEqual(["root", "p2", "t3", "p1", "t1", "t2"]);
    expect(rows.find((row) => row.id === "t1")?.level).toBe(2);
    expect(rows.find((row) => row.id === "t2")?.level).toBe(2);
  });

  it("does not move a child row outside its parent subtree", () => {
    const rows = moveRow(sample(), "b", -1);
    expect(rows.map((row) => row.id)).toEqual(sample().map((row) => row.id));
  });
});

describe("createTaskRow", () => {
  it("adds after the whole selected summary subtree", () => {
    const rows = createTaskRow(nested(), "p1");
    const ids = rows.map((row) => row.id);
    const inserted = rows.find((row) => row.name === "Новая задача");
    expect(ids.indexOf(inserted!.id)).toBe(4);
    expect(ids.slice(1, 5)).toEqual(["p1", "t1", "t2", inserted!.id]);
    expect(inserted?.level).toBe(1);
    expect(rows.find((row) => row.id === "t1")?.wbs).toBe("1.1.1");
    expect(inserted?.wbs).toBe("1.2");
  });
});

describe("insertTaskBelow", () => {
  it("adds below the whole selected summary subtree", () => {
    const rows = insertTaskBelow(nested(), "p1");
    const ids = rows.map((row) => row.id);
    const inserted = rows.find((row) => row.name === "Новая задача");
    expect(ids.indexOf(inserted!.id)).toBe(4);
    expect(ids.slice(1, 5)).toEqual(["p1", "t1", "t2", inserted!.id]);
    expect(inserted?.level).toBe(1);
  });
});

describe("deleteRow", () => {
  it("deletes a summary row with its descendants and related dependencies", () => {
    const deps: GanttDependency[] = [
      { id: "d1", fromId: "t1", toId: "t2", type: "FS" },
      { id: "d2", fromId: "t2", toId: "t3", type: "FS" },
      { id: "d3", fromId: "p2", toId: "t3", type: "FS" }
    ];
    const { rows, dependencies } = deleteRow(nested(), "p1", deps);
    expect(rows.map((row) => row.id)).toEqual(["root", "p2", "t3"]);
    expect(dependencies.map((dep) => dep.id)).toEqual(["d3"]);
  });
});

describe("visibleRows", () => {
  it("hides children of collapsed summary", () => {
    const visible = visibleRows(sample());
    expect(visible.some((r) => r.id === "e")).toBe(false);
    expect(visible.some((r) => r.id === "d")).toBe(true);
  });

  it("hides nested collapsed phase children while root stays expanded", () => {
    const visible = visibleRows(nested());
    const ids = visible.map((r) => r.id);
    expect(ids).toContain("root");
    expect(ids).toContain("p1");
    expect(ids).not.toContain("t1");
    expect(ids).not.toContain("t2");
    expect(ids).toContain("p2");
    expect(ids).toContain("t3");
  });

  it("hides entire subtree when root collapsed", () => {
    const rows = nested().map((r) => (r.id === "root" ? { ...r, collapsed: true } : r));
    const visible = visibleRows(rows);
    expect(visible.map((r) => r.id)).toEqual(["root"]);
  });
});

describe("hiddenRowIds", () => {
  it("matches visibleRows filter", () => {
    const rows = nested();
    const hidden = hiddenRowIds(rows);
    const visible = visibleRows(rows);
    expect(visible.length + hidden.size).toBe(rows.length);
  });
});

describe("toggleRowCollapsed", () => {
  it("toggles collapsed flag on summary", () => {
    const next = toggleRowCollapsed(nested(), "p1");
    expect(next.find((r) => r.id === "p1")?.collapsed).toBe(false);
  });
});

describe("visibleDependencies", () => {
  const deps: GanttDependency[] = [
    { id: "d1", fromId: "t1", toId: "t2", type: "FS" },
    { id: "d2", fromId: "t2", toId: "t3", type: "FS" }
  ];

  it("drops dependencies with hidden endpoint", () => {
    const visible = visibleRows(nested());
    const filtered = visibleDependencies(deps, visible);
    expect(filtered).toHaveLength(0);
  });

  it("keeps dependencies when both rows visible", () => {
    const rows = nested().map((r) => (r.id === "p1" ? { ...r, collapsed: false } : r));
    const visible = visibleRows(rows);
    const filtered = visibleDependencies(deps, visible);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((d) => d.fromId)).toContain("t1");
  });
});
