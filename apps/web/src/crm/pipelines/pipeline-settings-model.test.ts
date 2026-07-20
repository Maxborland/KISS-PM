import { describe, expect, it } from "vitest";

import type { DealStage, StageTransition } from "@/crm/lib/crm-client";
import { canCreateTransition, nextSortOrder, orderedStages, parseMinProbabilityInput, planStageOrder } from "./pipeline-settings-model";

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

describe("planStageOrder", () => {
  const stages = [stage("a", "p1", 1), stage("b", "p1", 2), stage("c", "p1", 3)];

  it("returns the full new ordering when moving up", () => {
    expect(planStageOrder(stages, "b", "up")).toEqual(["b", "a", "c"]);
  });

  it("returns the full new ordering when moving down", () => {
    expect(planStageOrder(stages, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("returns null at the edges or for an unknown stage", () => {
    expect(planStageOrder(stages, "a", "up")).toBeNull();
    expect(planStageOrder(stages, "c", "down")).toBeNull();
    expect(planStageOrder(stages, "zzz", "up")).toBeNull();
  });

  it("keeps other pipelines' stages out of the ordering", () => {
    const mixed = [...stages, stage("x", "p2", 1)];
    expect(planStageOrder(mixed, "b", "up")).toEqual(["b", "a", "c"]);
  });

  it("orders deterministically when neighbours share a sortOrder", () => {
    const tied = [stage("a", "p1", 1), stage("b", "p1", 1)];
    expect(planStageOrder(tied, "b", "up")).toEqual(["b", "a"]);
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
