import { describe, expect, it } from "vitest";

import { decideCrmPipelineTransition } from "./crmPipelineTransition";

const currentStage = {
  id: "stage-intake",
  lifecycleState: "open" as const,
  isFinal: false,
  status: "active" as const
};

const targetStage = {
  id: "stage-qualified",
  lifecycleState: "open" as const,
  isFinal: false,
  status: "active" as const
};

const rule = {
  id: "rule-intake-qualified",
  fromStageId: "stage-intake",
  toStageId: "stage-qualified",
  requiredPermission: null,
  requiredFields: [],
  requireReason: false,
  status: "active" as const
};

function decide(overrides: Partial<Parameters<typeof decideCrmPipelineTransition>[0]> = {}) {
  return decideCrmPipelineTransition({
    currentStage,
    targetStage,
    transitionRules: [rule],
    actorPermissions: ["tenant.opportunities.manage"],
    providedFields: {},
    reason: null,
    ...overrides
  });
}

describe("CRM pipeline transition decisions", () => {
  it("allows an active rule between the current and target stage", () => {
    expect(decide()).toEqual({
      ok: true,
      ruleId: "rule-intake-qualified",
      fromStageId: "stage-intake",
      toStageId: "stage-qualified"
    });
  });

  it("denies when no transition rule exists for the requested edge", () => {
    expect(decide({ targetStage: { ...targetStage, id: "stage-won" } })).toEqual({
      ok: false,
      reason: "transition_rule_missing"
    });
  });

  it("denies inactive transition rules", () => {
    expect(
      decide({ transitionRules: [{ ...rule, status: "archived" }] })
    ).toEqual({ ok: false, reason: "transition_rule_inactive" });
  });

  it("locks transitions from final stages", () => {
    expect(
      decide({
        currentStage: {
          id: "stage-won",
          lifecycleState: "won_closed",
          isFinal: true,
          status: "active"
        },
        transitionRules: [
          { ...rule, fromStageId: "stage-won", toStageId: "stage-qualified" }
        ]
      })
    ).toEqual({ ok: false, reason: "current_stage_final_locked" });
  });

  it("requires a transition reason when the rule says so", () => {
    expect(
      decide({ transitionRules: [{ ...rule, requireReason: true }] })
    ).toEqual({ ok: false, reason: "transition_reason_required" });

    expect(
      decide({ transitionRules: [{ ...rule, requireReason: true }], reason: " Qualified " })
    ).toMatchObject({ ok: true });
  });

  it("requires configured fields to be present and non-empty", () => {
    expect(
      decide({ transitionRules: [{ ...rule, requiredFields: ["contractValue", "decisionMaker"] }] })
    ).toEqual({
      ok: false,
      reason: "required_fields_missing",
      missingFields: ["contractValue", "decisionMaker"]
    });

    expect(
      decide({
        transitionRules: [{ ...rule, requiredFields: ["contractValue"] }],
        providedFields: { contractValue: 960000 }
      })
    ).toMatchObject({ ok: true });
  });

  it("treats empty array required fields as missing", () => {
    expect(
      decide({
        transitionRules: [{ ...rule, requiredFields: ["demand"] }],
        providedFields: { demand: [] }
      })
    ).toEqual({
      ok: false,
      reason: "required_fields_missing",
      missingFields: ["demand"]
    });

    expect(
      decide({
        transitionRules: [{ ...rule, requiredFields: ["demand"] }],
        providedFields: { demand: [{ positionId: "position-engineer", requiredHours: 80 }] }
      })
    ).toMatchObject({ ok: true });
  });

  it("requires the permission named by the transition rule", () => {
    expect(
      decide({
        transitionRules: [{ ...rule, requiredPermission: "tenant.project_activation.manage" }],
        actorPermissions: ["tenant.opportunities.manage"]
      })
    ).toEqual({
      ok: false,
      reason: "required_permission_missing",
      requiredPermission: "tenant.project_activation.manage"
    });

    expect(
      decide({
        transitionRules: [{ ...rule, requiredPermission: "tenant.project_activation.manage" }],
        actorPermissions: ["tenant.opportunities.manage", "tenant.project_activation.manage"]
      })
    ).toMatchObject({ ok: true });
  });
});
