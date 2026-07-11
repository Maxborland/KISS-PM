import { describe, expect, it } from "vitest";

import type { ScenarioProposal } from "@kiss-pm/domain";

import { serializeScenarioProposal } from "./planningRouteHelpers";
import { parseScenarioProposal, scenarioIsAvailable } from "./planningScenarioIntegrity";

const AVAILABLE: ScenarioProposal = {
  id: "scenario-aggressive",
  profile: "aggressive",
  conflictEffect: "accepted",
  availability: "available",
  unavailableReason: null,
  planDelta: {
    commands: [
      {
        type: "risk.accept_overload",
        payload: {
          overloadId: "resource-alpha:2026-07-11",
          acceptedRiskReason: "Scenario preview placeholder"
        }
      }
    ],
    changedTaskIds: [],
    changedAssignmentIds: [],
    changedDependencyIds: [],
    acceptedRiskIds: ["resource-alpha:2026-07-11"]
  },
  explainability: {
    finishDate: "2026-07-11",
    deadlineDeltaDays: 0,
    overloadMinutes: 120,
    overloadedResourceIds: ["resource-alpha"],
    changedTaskIds: [],
    changedAssignmentIds: [],
    dependencyWarnings: [],
    requiredApprovals: ["tenant.planning_scenarios.apply"],
    riskScore: 80
  }
};

describe("planning scenario availability contract", () => {
  it("round-trips an available proposal through persisted payload serialization", () => {
    const parsed = parseScenarioProposal(serializeScenarioProposal(AVAILABLE));
    expect(parsed).toMatchObject({
      availability: "available",
      unavailableReason: null
    });
    expect(parsed && scenarioIsAvailable(parsed)).toBe(true);
  });

  it("round-trips an unavailable profile without executable commands", () => {
    const payload = serializeScenarioProposal({
      ...AVAILABLE,
      id: "scenario-balanced",
      profile: "balanced",
      conflictEffect: "reduced",
      availability: "unavailable",
      unavailableReason: "no_eligible_alternate_resource",
      planDelta: {
        ...AVAILABLE.planDelta,
        commands: [],
        acceptedRiskIds: []
      }
    });
    const parsed = parseScenarioProposal(payload);
    expect(parsed).toMatchObject({
      availability: "unavailable",
      unavailableReason: "no_eligible_alternate_resource",
      planDelta: { commands: [] }
    });
    expect(parsed && scenarioIsAvailable(parsed)).toBe(false);
  });

  it("fails closed for legacy or contradictory availability payloads", () => {
    const serialized = serializeScenarioProposal(AVAILABLE);
    expect(parseScenarioProposal({ ...serialized, availability: undefined })).toBeNull();
    expect(
      parseScenarioProposal({
        ...serialized,
        availability: "unavailable",
        unavailableReason: null
      })
    ).toBeNull();
  });
});
