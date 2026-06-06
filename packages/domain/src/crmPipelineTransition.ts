import type { CrmPipelineLifecycleState, CrmPipelineStatus } from "./crmPipeline";

export type CrmPipelineTransitionStageRef = {
  id: string;
  lifecycleState: CrmPipelineLifecycleState;
  isFinal: boolean;
  status: CrmPipelineStatus;
};

export type CrmPipelineTransitionRuleRef = {
  id: string;
  fromStageId: string;
  toStageId: string;
  requiredPermission: string | null;
  requiredFields: readonly string[];
  requireReason: boolean;
  status: CrmPipelineStatus;
};

export type CrmPipelineTransitionDecisionInput = {
  currentStage: CrmPipelineTransitionStageRef;
  targetStage: CrmPipelineTransitionStageRef;
  transitionRules: readonly CrmPipelineTransitionRuleRef[];
  actorPermissions: readonly string[];
  providedFields: Record<string, unknown>;
  reason: string | null;
};

export type CrmPipelineTransitionAllowedDecision = {
  ok: true;
  ruleId: string;
  fromStageId: string;
  toStageId: string;
};

export type CrmPipelineTransitionDeniedDecision =
  | {
      ok: false;
      reason:
        | "current_stage_final_locked"
        | "current_stage_inactive"
        | "target_stage_inactive"
        | "transition_rule_missing"
        | "transition_rule_inactive"
        | "transition_reason_required";
    }
  | {
      ok: false;
      reason: "required_fields_missing";
      missingFields: string[];
    }
  | {
      ok: false;
      reason: "required_permission_missing";
      requiredPermission: string;
    };

export type CrmPipelineTransitionDecision =
  | CrmPipelineTransitionAllowedDecision
  | CrmPipelineTransitionDeniedDecision;

export function decideCrmPipelineTransition(
  input: CrmPipelineTransitionDecisionInput
): CrmPipelineTransitionDecision {
  if (input.currentStage.isFinal) {
    return { ok: false, reason: "current_stage_final_locked" };
  }
  if (input.currentStage.status !== "active") {
    return { ok: false, reason: "current_stage_inactive" };
  }
  if (input.targetStage.status !== "active") {
    return { ok: false, reason: "target_stage_inactive" };
  }

  const edgeRules = input.transitionRules.filter(
    (rule) =>
      rule.fromStageId === input.currentStage.id && rule.toStageId === input.targetStage.id
  );
  const activeRule = edgeRules.find((rule) => rule.status === "active");
  if (!activeRule) {
    return {
      ok: false,
      reason: edgeRules.length > 0 ? "transition_rule_inactive" : "transition_rule_missing"
    };
  }

  if (activeRule.requireReason && !hasText(input.reason)) {
    return { ok: false, reason: "transition_reason_required" };
  }

  const missingFields = activeRule.requiredFields.filter(
    (fieldKey) => !hasRequiredValue(input.providedFields[fieldKey])
  );
  if (missingFields.length > 0) {
    return { ok: false, reason: "required_fields_missing", missingFields };
  }

  if (
    activeRule.requiredPermission &&
    !input.actorPermissions.includes(activeRule.requiredPermission)
  ) {
    return {
      ok: false,
      reason: "required_permission_missing",
      requiredPermission: activeRule.requiredPermission
    };
  }

  return {
    ok: true,
    ruleId: activeRule.id,
    fromStageId: input.currentStage.id,
    toStageId: input.targetStage.id
  };
}

function hasText(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRequiredValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}
