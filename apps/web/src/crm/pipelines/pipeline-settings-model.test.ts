import { describe, expect, it } from "vitest";

import type { DealStage, StageTransition } from "@/crm/lib/crm-client";
import { canCreateTransition, nextSortOrder, orderedStages, parseMinProbabilityInput, planStageReorder } from "./pipeline-settings-model";

const t = "2026-01-01T00:00:00.000Z";
const stage = (id: string, pipelineId: string, sortOrder: number, status: "active" | "archived" = "active"): DealStage => ({
  id, tenantId: "tenant-alpha", pipelineId, name: id, sortOrder, status, createdAt: t, updatedAt: t
});

describe("nextSortOrder", () => {
  it("returns 1 for an empty set and max+1 otherwise", () => {
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([{ sortOrder: 2 }, { sortOrder: 5 }, { sortOrder: 3 }])).toBe(6);
  });
});

describe("orderedStages", () => {
  it("keeps only the pipeline's stages, sorted by sortOrder", () => {
    const stages = [stage("b", "p1", 2), stage("a", "p1", 1), stage("x", "p2", 1)];
    expect(orderedStages(stages, "p1").map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("planStageReorder", () => {
  const stages = [stage("a", "p1", 1), stage("b", "p1", 2), stage("c", "p1", 3)];

  it("swaps sortOrder values with the neighbour above", () => {
    expect(planStageReorder(stages, "b", "up")).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 }
    ]);
  });

  it("swaps sortOrder values with the neighbour below", () => {
    expect(planStageReorder(stages, "b", "down")).toEqual([
      { id: "b", sortOrder: 3 },
      { id: "c", sortOrder: 2 }
    ]);
  });

  it("returns null at the edges or for an unknown stage", () => {
    expect(planStageReorder(stages, "a", "up")).toBeNull();
    expect(planStageReorder(stages, "c", "down")).toBeNull();
    expect(planStageReorder(stages, "zzz", "up")).toBeNull();
  });

  it("nudges deterministically when neighbours share a sortOrder", () => {
    const tied = [stage("a", "p1", 1), stage("b", "p1", 1)];
    expect(planStageReorder(tied, "b", "up")).toEqual([{ id: "b", sortOrder: 0 }]);
  });
});

describe("parseMinProbabilityInput", () => {
  it("treats empty as no threshold", () => {
    expect(parseMinProbabilityInput("  ")).toEqual({ ok: true, value: null });
  });

  it("accepts integers 0..100 and rejects the rest", () => {
    expect(parseMinProbabilityInput("50")).toEqual({ ok: true, value: 50 });
    expect(parseMinProbabilityInput("0")).toEqual({ ok: true, value: 0 });
    expect(parseMinProbabilityInput("100")).toEqual({ ok: true, value: 100 });
    expect(parseMinProbabilityInput("101").ok).toBe(false);
    expect(parseMinProbabilityInput("-1").ok).toBe(false);
    expect(parseMinProbabilityInput("50.5").ok).toBe(false);
    expect(parseMinProbabilityInput("нет").ok).toBe(false);
  });
});

describe("canCreateTransition", () => {
  const transitions: StageTransition[] = [
    { id: "st1", tenantId: "tenant-alpha", pipelineId: "p1", fromStageId: "a", toStageId: "b", requireFeasibilityOk: false, minProbability: null, guardNote: null, createdAt: t, updatedAt: t }
  ];

  it("rejects empty, identical, and already-existing pairs", () => {
    expect(canCreateTransition(transitions, "p1", "", "b")).toBe(false);
    expect(canCreateTransition(transitions, "p1", "a", "a")).toBe(false);
    expect(canCreateTransition(transitions, "p1", "a", "b")).toBe(false);
  });

  it("accepts a new distinct pair, and the same pair in another pipeline", () => {
    expect(canCreateTransition(transitions, "p1", "b", "a")).toBe(true);
    expect(canCreateTransition(transitions, "p2", "a", "b")).toBe(true);
  });
});
