import { describe, expect, it } from "vitest";

import {
  createsDependencyCycle,
  dependencyTypeFromEndpoints,
  isDuplicateDependency,
  validateDependency,
  validateDependencyCreation,
  wouldCreateCycle
} from "./gantt-dependency-rules";
import type { GanttDependency, GanttRow } from "./types";

const task = (id: string, kind: GanttRow["kind"] = "task"): GanttRow => ({
  id,
  level: 1,
  kind,
  name: id,
  startDay: 0,
  durationDays: 3
});

const chainDeps: GanttDependency[] = [
  { id: "d1", fromId: "a", toId: "b", type: "FS" },
  { id: "d2", fromId: "b", toId: "c", type: "FS" }
];

describe("dependencyTypeFromEndpoints", () => {
  it("maps endpoint pairs to FS SS FF SF", () => {
    expect(dependencyTypeFromEndpoints("finish", "start")).toBe("FS");
    expect(dependencyTypeFromEndpoints("start", "start")).toBe("SS");
    expect(dependencyTypeFromEndpoints("finish", "finish")).toBe("FF");
    expect(dependencyTypeFromEndpoints("start", "finish")).toBe("SF");
  });
});

describe("validateDependency", () => {
  it("rejects self dependency", () => {
    const issue = validateDependency({ fromId: "a", toId: "a" }, [], new Set(["a"]));
    expect(issue?.code).toBe("self");
    expect(issue?.message).toBe("Нельзя связать задачу саму с собой");
  });

  it("rejects duplicate", () => {
    const issue = validateDependency({ fromId: "a", toId: "b" }, chainDeps, new Set(["a", "b", "c"]));
    expect(issue?.code).toBe("duplicate");
    expect(issue?.message).toBe("Такая связь уже существует");
  });
});

describe("wouldCreateCycle", () => {
  it("detects cycle when linking c to a", () => {
    expect(wouldCreateCycle(chainDeps, "c", "a")).toBe(true);
  });

  it("allows acyclic link", () => {
    expect(wouldCreateCycle(chainDeps, "a", "d")).toBe(false);
  });
});

describe("validateDependencyCreation", () => {
  const rows = [task("a"), task("b"), task("c")];
  const visible = new Set(["a", "b", "c"]);

  it("blocks self dependency", () => {
    const r = validateDependencyCreation({
      fromId: "a",
      fromEndpoint: "finish",
      toId: "a",
      toEndpoint: "start",
      dependencies: [],
      rows,
      visibleRowIds: visible
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Нельзя связать задачу саму с собой");
  });

  it("blocks duplicate FS", () => {
    const r = validateDependencyCreation({
      fromId: "a",
      fromEndpoint: "finish",
      toId: "b",
      toEndpoint: "start",
      dependencies: chainDeps,
      rows,
      visibleRowIds: visible
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Такая связь уже существует");
  });

  it("blocks cycle", () => {
    const r = validateDependencyCreation({
      fromId: "c",
      fromEndpoint: "finish",
      toId: "a",
      toEndpoint: "start",
      dependencies: chainDeps,
      rows,
      visibleRowIds: visible
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Такая связь создаёт циклическую зависимость");
  });

  it("blocks hidden row", () => {
    const r = validateDependencyCreation({
      fromId: "a",
      fromEndpoint: "finish",
      toId: "b",
      toEndpoint: "start",
      dependencies: [],
      rows,
      visibleRowIds: new Set(["a"])
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Нельзя связать скрытую задачу");
  });

  it("blocks summary rows", () => {
    const r = validateDependencyCreation({
      fromId: "a",
      fromEndpoint: "finish",
      toId: "s",
      toEndpoint: "start",
      dependencies: [],
      rows: [task("a"), task("s", "summary")],
      visibleRowIds: new Set(["a", "s"])
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Для суммарных задач связь пока недоступна");
  });

  it("allows valid SS link", () => {
    const r = validateDependencyCreation({
      fromId: "a",
      fromEndpoint: "start",
      toId: "c",
      toEndpoint: "start",
      dependencies: chainDeps,
      rows,
      visibleRowIds: visible
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe("SS");
  });
});

describe("createsDependencyCycle alias", () => {
  it("detects cycle and duplicate", () => {
    const deps: GanttDependency[] = [
      { id: "d1", fromId: "a", toId: "b" },
      { id: "d2", fromId: "b", toId: "c" }
    ];
    expect(createsDependencyCycle(deps, "c", "a")).toBe(true);
    expect(isDuplicateDependency(deps, "a", "b", "FS")).toBe(true);
  });
});
