import { describe, expect, it } from "vitest";

import { resolveOpportunityPipelineId, stagesForOpportunity } from "./deal-card-surface";
import type { DealStage, Opportunity } from "../lib/crm-client";

const stage = (id: string, pipelineId: string | null, sortOrder: number): DealStage => ({
  id,
  tenantId: "tenant-alpha",
  pipelineId,
  name: id,
  sortOrder,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const opportunity = (overrides: Partial<Pick<Opportunity, "stageId" | "pipelineId">>): Pick<Opportunity, "stageId" | "pipelineId"> => ({
  stageId: "stage-qual",
  pipelineId: null,
  ...overrides
});

describe("deal-card stage pipeline resolution", () => {
  it("falls back to the current stage pipeline for legacy opportunities without pipelineId", () => {
    const stages = [
      stage("stage-contract", "pipeline-main", 3),
      stage("stage-qual", "pipeline-main", 2),
      stage("stage-partner-lead", "pipeline-partner", 1),
      stage("stage-lead", "pipeline-main", 1)
    ];

    const legacy = opportunity({ pipelineId: null, stageId: "stage-qual" });

    expect(resolveOpportunityPipelineId(legacy, stages)).toBe("pipeline-main");
    expect(stagesForOpportunity(legacy, stages).map((s) => s.id)).toEqual([
      "stage-lead",
      "stage-qual",
      "stage-contract"
    ]);
  });

  it("keeps explicit opportunity pipelineId authoritative", () => {
    const stages = [stage("stage-qual", "pipeline-main", 1), stage("stage-partner-lead", "pipeline-partner", 1)];

    expect(resolveOpportunityPipelineId(opportunity({ pipelineId: "pipeline-partner" }), stages)).toBe("pipeline-partner");
    expect(stagesForOpportunity(opportunity({ pipelineId: "pipeline-partner" }), stages).map((s) => s.id)).toEqual([
      "stage-partner-lead"
    ]);
  });
});