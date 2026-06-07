import { describe, expect, it } from "vitest";

import {
  buildCrmPipelineLifecycleGraph,
  isCrmPipelineAutomationTrigger,
  isCrmPipelineLifecycleState,
  isCrmPipelineStatus
} from "./index";

describe("CRM pipeline domain contract", () => {
  it("builds deterministic lifecycle graph metadata from pipeline-scoped stages and rules", () => {
    const graph = buildCrmPipelineLifecycleGraph({
      pipelineId: "pipeline-sales",
      stages: [
        {
          id: "stage-won",
          sortOrder: 30,
          status: "active",
          lifecycleState: "won_closed",
          isFinal: true
        },
        {
          id: "stage-new",
          sortOrder: 10,
          status: "active",
          lifecycleState: "open",
          isFinal: false
        },
        {
          id: "stage-qualified",
          sortOrder: 20,
          status: "active",
          lifecycleState: "open",
          isFinal: false
        }
      ],
      transitionRules: [
        {
          id: "rule-win",
          fromStageId: "stage-qualified",
          toStageId: "stage-won",
          requireReason: true,
          requiredFields: ["contractValue"]
        },
        {
          id: "rule-qualify",
          fromStageId: "stage-new",
          toStageId: "stage-qualified",
          requireReason: false,
          requiredFields: []
        }
      ]
    });

    expect(graph).toEqual({
      pipelineId: "pipeline-sales",
      initialStageId: "stage-new",
      finalStageIds: ["stage-won"],
      stages: [
        {
          stageId: "stage-new",
          sortOrder: 10,
          lifecycleState: "open",
          isFinal: false
        },
        {
          stageId: "stage-qualified",
          sortOrder: 20,
          lifecycleState: "open",
          isFinal: false
        },
        {
          stageId: "stage-won",
          sortOrder: 30,
          lifecycleState: "won_closed",
          isFinal: true
        }
      ],
      transitions: [
        { ruleId: "rule-qualify", fromStageId: "stage-new", toStageId: "stage-qualified" },
        { ruleId: "rule-win", fromStageId: "stage-qualified", toStageId: "stage-won" }
      ]
    });
  });

  it("uses the first active non-final stage as the lifecycle graph initial stage", () => {
    const stages: Array<{
      id: string;
      sortOrder: number;
      status: "active" | "archived";
      lifecycleState: "open" | "won_closed";
      isFinal: boolean;
    }> = [
      {
        id: "stage-intake",
        sortOrder: 10,
        status: "archived",
        lifecycleState: "open",
        isFinal: false
      },
      {
        id: "stage-qualified",
        sortOrder: 20,
        status: "active",
        lifecycleState: "open",
        isFinal: false
      },
      {
        id: "stage-won",
        sortOrder: 30,
        status: "active",
        lifecycleState: "won_closed",
        isFinal: true
      }
    ];

    const graph = buildCrmPipelineLifecycleGraph({
      pipelineId: "pipeline-sales",
      stages,
      transitionRules: []
    });

    expect(graph.initialStageId).toBe("stage-qualified");
  });

  it("rejects CRM pipeline stages with inconsistent finality and lifecycle state", () => {
    expect(() =>
      buildCrmPipelineLifecycleGraph({
        pipelineId: "pipeline-sales",
        stages: [
          {
            id: "stage-open-final",
            sortOrder: 10,
            status: "active",
            lifecycleState: "open",
            isFinal: true
          }
        ],
        transitionRules: []
      })
    ).toThrow("CRM pipeline stage finality must match lifecycle state");

    expect(() =>
      buildCrmPipelineLifecycleGraph({
        pipelineId: "pipeline-sales",
        stages: [
          {
            id: "stage-won",
            sortOrder: 10,
            status: "active",
            lifecycleState: "won_closed",
            isFinal: false
          }
        ],
        transitionRules: []
      })
    ).toThrow("CRM pipeline stage finality must match lifecycle state");
  });

  it("keeps CRM pipeline enum guards explicit", () => {
    expect(isCrmPipelineStatus("active")).toBe(true);
    expect(isCrmPipelineStatus("draft")).toBe(false);
    expect(isCrmPipelineLifecycleState("lost_rejected")).toBe(true);
    expect(isCrmPipelineLifecycleState("cancelled")).toBe(false);
    expect(isCrmPipelineAutomationTrigger("stage_entered")).toBe(true);
    expect(isCrmPipelineAutomationTrigger("webhook")).toBe(false);
  });
});
