import type { ScenarioProposal, ScenarioTarget } from "@kiss-pm/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PlanningScenarioPanel,
  proposalRequiresAcceptedRiskReason
} from "./PlanningScenarioPanel";
import { createPlanningReadModelFixture } from "./planningReadModel.test-utils";
import { scenarioTargetKey } from "./planningScenarioTarget";

describe("PlanningScenarioPanel", () => {
  it("renders an explicit empty target state without fake scenario controls", () => {
    const html = renderToStaticMarkup(
      <PlanningScenarioPanel
        readModel={createPlanningReadModelFixture()}
        target={null}
        canPreviewScenarios={false}
        canApplyScenarios={false}
        isPreviewPending={false}
        isApplyPending={false}
        onPreview={async () => scenarioPreviewFixture()}
        onApply={async () => ({
          scenarioRunId: "scenario-a",
          newPlanVersion: 4,
          auditEventId: null,
          readModel: createPlanningReadModelFixture()
        })}
        onApplied={() => undefined}
      />
    );

    expect(html).toContain("Сценарии");
    expect(html).toContain("Выберите перегруз");
    expect(html).toContain("Сначала выберите перегруз");
  });

  it("renders a selected overload target and permission reason for preview", () => {
    const html = renderToStaticMarkup(
      <PlanningScenarioPanel
        readModel={createPlanningReadModelFixture()}
        target={scenarioTargetFixture()}
        canPreviewScenarios={false}
        canApplyScenarios={false}
        isPreviewPending={false}
        isApplyPending={false}
        onPreview={async () => scenarioPreviewFixture()}
        onApply={async () => ({
          scenarioRunId: "scenario-a",
          newPlanVersion: 4,
          auditEventId: null,
          readModel: createPlanningReadModelFixture()
        })}
        onApplied={() => undefined}
      />
    );

    expect(html).toContain("resource-alpha / 2026-06-01");
    expect(html).toContain("3 ч перегруза");
    expect(html).toContain("Нужно право tenant.planning_scenarios.preview");
  });

  it("detects proposals that require an accepted risk reason", () => {
    expect(proposalRequiresAcceptedRiskReason(scenarioProposalFixture("aggressive"))).toBe(true);
    expect(proposalRequiresAcceptedRiskReason(scenarioProposalFixture("balanced"))).toBe(false);
  });

  it("keys scenario targets by conflict identity and affected task set", () => {
    expect(scenarioTargetKey(scenarioTargetFixture(["task-b", "task-a"]))).toBe(
      "resource_overload:resource-alpha:2026-06-01:180:task-a,task-b"
    );
  });
});

function scenarioTargetFixture(taskIds = ["task-a"]): ScenarioTarget {
  return {
    type: "resource_overload",
    resourceId: "resource-alpha",
    date: "2026-06-01",
    overloadMinutes: 180,
    taskIds
  };
}

function scenarioPreviewFixture() {
  return {
    proposals: [scenarioProposalFixture("aggressive")],
    planVersion: 3,
    engineVersion: "planning-core-v1",
    expiresAt: "2026-06-01T10:15:00.000Z"
  };
}

function scenarioProposalFixture(profile: ScenarioProposal["profile"]): ScenarioProposal {
  return {
    id: `scenario-${profile}`,
    profile,
    conflictEffect: profile === "aggressive" ? "accepted" : "reduced",
    planDelta: {
      commands: profile === "aggressive"
        ? [{
            type: "risk.accept_overload",
            payload: {
              overloadId: "resource-alpha:2026-06-01",
              acceptedRiskReason: "temporary"
            }
          }]
        : [],
      changedTaskIds: ["task-a"],
      changedAssignmentIds: [],
      changedDependencyIds: [],
      acceptedRiskIds: profile === "aggressive" ? ["resource-alpha:2026-06-01"] : []
    },
    explainability: {
      finishDate: "2026-06-03",
      deadlineDeltaDays: 0,
      overloadMinutes: 180,
      overloadedResourceIds: ["resource-alpha"],
      changedTaskIds: ["task-a"],
      changedAssignmentIds: [],
      dependencyWarnings: [],
      requiredApprovals: [],
      riskScore: 70
    }
  };
}
