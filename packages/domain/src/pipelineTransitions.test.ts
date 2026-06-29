import { describe, expect, it } from "vitest";

import {
  evaluatePipelineChange,
  evaluateStageTransition,
  type StageTransitionRule
} from "./pipelineTransitions";

const transitions: StageTransitionRule[] = [
  { fromStageId: "lead", toStageId: "qual", requireFeasibilityOk: false, minProbability: null },
  { fromStageId: "qual", toStageId: "won", requireFeasibilityOk: true, minProbability: 50 }
];

const baseOpportunity = {
  finalized: false,
  stageId: "lead" as string | null,
  pipelineId: "pipeline-main" as string | null,
  probability: 60,
  feasibilityStatus: "ok" as string | null
};

describe("evaluateStageTransition", () => {
  it("allows a transition declared in the pipeline", () => {
    const decision = evaluateStageTransition({
      opportunity: baseOpportunity,
      targetStage: { id: "qual", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision.allowed).toBe(true);
  });

  it("allows a no-op move to the current stage", () => {
    const decision = evaluateStageTransition({
      opportunity: baseOpportunity,
      targetStage: { id: "lead", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision.allowed).toBe(true);
  });

  it("allows initial placement when the opportunity has no stage yet", () => {
    const decision = evaluateStageTransition({
      opportunity: { ...baseOpportunity, stageId: null },
      targetStage: { id: "won", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision.allowed).toBe(true);
  });

  it("does not restrict moves when the pipeline has no declared transitions (back-compat)", () => {
    const decision = evaluateStageTransition({
      opportunity: baseOpportunity,
      targetStage: { id: "won", pipelineId: "pipeline-main" },
      transitions: []
    });
    expect(decision.allowed).toBe(true);
  });

  it("blocks a transition not declared in the pipeline", () => {
    const decision = evaluateStageTransition({
      opportunity: baseOpportunity,
      targetStage: { id: "won", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision).toMatchObject({ allowed: false, reason: "transition_not_allowed" });
  });

  it("blocks a finalized opportunity", () => {
    const decision = evaluateStageTransition({
      opportunity: { ...baseOpportunity, finalized: true },
      targetStage: { id: "qual", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision).toMatchObject({ allowed: false, reason: "opportunity_finalized" });
  });

  it("routes a cross-pipeline target away from stage transitions", () => {
    const decision = evaluateStageTransition({
      opportunity: baseOpportunity,
      targetStage: { id: "other-lead", pipelineId: "pipeline-other" },
      transitions
    });
    expect(decision).toMatchObject({ allowed: false, reason: "cross_pipeline_move" });
  });

  it("blocks when probability is below the transition condition", () => {
    const decision = evaluateStageTransition({
      opportunity: { ...baseOpportunity, stageId: "qual", probability: 30 },
      targetStage: { id: "won", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision).toMatchObject({ allowed: false, reason: "condition_probability" });
  });

  it("blocks when feasibility is not ok for a guarded transition", () => {
    const decision = evaluateStageTransition({
      opportunity: { ...baseOpportunity, stageId: "qual", feasibilityStatus: "conflict" },
      targetStage: { id: "won", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision).toMatchObject({ allowed: false, reason: "condition_feasibility" });
  });

  it("allows a guarded transition when all conditions are met", () => {
    const decision = evaluateStageTransition({
      opportunity: { ...baseOpportunity, stageId: "qual", probability: 80, feasibilityStatus: "ok" },
      targetStage: { id: "won", pipelineId: "pipeline-main" },
      transitions
    });
    expect(decision.allowed).toBe(true);
  });
});

describe("evaluatePipelineChange", () => {
  const target = {
    targetPipeline: { id: "pipeline-b", status: "active" },
    targetStage: { pipelineId: "pipeline-b", status: "active" }
  };

  it("allows moving an active opportunity onto a stage of the target pipeline", () => {
    const decision = evaluatePipelineChange({ opportunity: { finalized: false }, ...target });
    expect(decision.allowed).toBe(true);
  });

  it("blocks a finalized opportunity", () => {
    const decision = evaluatePipelineChange({ opportunity: { finalized: true }, ...target });
    expect(decision).toMatchObject({ allowed: false, reason: "opportunity_finalized" });
  });

  it("blocks an archived target pipeline", () => {
    const decision = evaluatePipelineChange({
      opportunity: { finalized: false },
      targetPipeline: { id: "pipeline-b", status: "archived" },
      targetStage: { pipelineId: "pipeline-b", status: "active" }
    });
    expect(decision).toMatchObject({ allowed: false, reason: "pipeline_archived" });
  });

  it("blocks an archived target stage", () => {
    const decision = evaluatePipelineChange({
      opportunity: { finalized: false },
      targetPipeline: { id: "pipeline-b", status: "active" },
      targetStage: { pipelineId: "pipeline-b", status: "archived" }
    });
    expect(decision).toMatchObject({ allowed: false, reason: "deal_stage_inactive" });
  });

  it("blocks a stage that belongs to another pipeline", () => {
    const decision = evaluatePipelineChange({
      opportunity: { finalized: false },
      targetPipeline: { id: "pipeline-b", status: "active" },
      targetStage: { pipelineId: "pipeline-c", status: "active" }
    });
    expect(decision).toMatchObject({ allowed: false, reason: "stage_not_in_pipeline" });
  });
});
