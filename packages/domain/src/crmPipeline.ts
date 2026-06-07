import type { TenantId } from "./index";

export type CrmPipelineStatus = "active" | "archived";
export type CrmPipelineLifecycleState = "open" | "won_closed" | "lost_rejected";
export type CrmPipelineAutomationTrigger = "stage_entered" | "stage_left";

export type CrmPipelineLifecycleGraphStage = {
  stageId: string;
  sortOrder: number;
  lifecycleState: CrmPipelineLifecycleState;
  isFinal: boolean;
};

export type CrmPipelineLifecycleGraphTransition = {
  ruleId: string;
  fromStageId: string;
  toStageId: string;
};

export type CrmPipelineLifecycleGraph = {
  pipelineId: string;
  initialStageId: string | null;
  finalStageIds: string[];
  stages: CrmPipelineLifecycleGraphStage[];
  transitions: CrmPipelineLifecycleGraphTransition[];
};

export type CrmPipeline = {
  id: string;
  tenantId: TenantId;
  name: string;
  status: CrmPipelineStatus;
  lifecycleGraphMetadata: CrmPipelineLifecycleGraph;
  createdAt: Date;
  updatedAt: Date;
};

export type CrmPipelineStage = {
  id: string;
  tenantId: TenantId;
  pipelineId: string;
  name: string;
  sortOrder: number;
  status: CrmPipelineStatus;
  lifecycleState: CrmPipelineLifecycleState;
  isFinal: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CrmPipelineTransitionRule = {
  id: string;
  tenantId: TenantId;
  pipelineId: string;
  fromStageId: string;
  toStageId: string;
  requiredPermission: string | null;
  requiredFields: string[];
  requireReason: boolean;
  status: CrmPipelineStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CrmPipelineStageAutomationDefinition = {
  id: string;
  tenantId: TenantId;
  pipelineId: string;
  stageId: string;
  trigger: CrmPipelineAutomationTrigger;
  actionType: string;
  actionConfig: Record<string, unknown>;
  status: CrmPipelineStatus;
  createdAt: Date;
  updatedAt: Date;
};

const crmPipelineStatuses = ["active", "archived"] as const;
const crmPipelineLifecycleStates = ["open", "won_closed", "lost_rejected"] as const;
const crmPipelineAutomationTriggers = ["stage_entered", "stage_left"] as const;

function hasConsistentStageFinality(stage: {
  lifecycleState: CrmPipelineLifecycleState;
  isFinal: boolean;
}): boolean {
  return stage.isFinal
    ? stage.lifecycleState === "won_closed" || stage.lifecycleState === "lost_rejected"
    : stage.lifecycleState === "open";
}

export function isCrmPipelineStatus(value: string): value is CrmPipelineStatus {
  return crmPipelineStatuses.includes(value as CrmPipelineStatus);
}

export function isCrmPipelineLifecycleState(
  value: string
): value is CrmPipelineLifecycleState {
  return crmPipelineLifecycleStates.includes(value as CrmPipelineLifecycleState);
}

export function isCrmPipelineAutomationTrigger(
  value: string
): value is CrmPipelineAutomationTrigger {
  return crmPipelineAutomationTriggers.includes(value as CrmPipelineAutomationTrigger);
}

export function buildCrmPipelineLifecycleGraph(input: {
  pipelineId: string;
  stages: Array<{
    id: string;
    sortOrder: number;
    status?: CrmPipelineStatus;
    lifecycleState: CrmPipelineLifecycleState;
    isFinal: boolean;
  }>;
  transitionRules: Array<{
    id: string;
    fromStageId: string;
    toStageId: string;
    requireReason: boolean;
    requiredFields: readonly string[];
  }>;
}): CrmPipelineLifecycleGraph {
  const hasInconsistentStage = input.stages.some(
    (stage) => !hasConsistentStageFinality(stage)
  );

  if (hasInconsistentStage) {
    throw new Error("CRM pipeline stage finality must match lifecycle state");
  }

  const sortedStages = [...input.stages].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
  );
  const stages = sortedStages.map((stage) => ({
    stageId: stage.id,
    sortOrder: stage.sortOrder,
    lifecycleState: stage.lifecycleState,
    isFinal: stage.isFinal
  }));
  const stageIds = new Set(stages.map((stage) => stage.stageId));
  const transitions = input.transitionRules
    .filter(
      (rule) =>
        rule.fromStageId !== rule.toStageId &&
        stageIds.has(rule.fromStageId) &&
        stageIds.has(rule.toStageId)
    )
    .sort(
      (left, right) =>
        left.fromStageId.localeCompare(right.fromStageId) ||
        left.toStageId.localeCompare(right.toStageId) ||
        left.id.localeCompare(right.id)
    )
    .map((rule) => ({
      ruleId: rule.id,
      fromStageId: rule.fromStageId,
      toStageId: rule.toStageId
    }));

  return {
    pipelineId: input.pipelineId,
    initialStageId:
      sortedStages.find((stage) => stage.status !== "archived" && !stage.isFinal)?.id ??
      null,
    finalStageIds: stages.filter((stage) => stage.isFinal).map((stage) => stage.stageId),
    stages,
    transitions
  };
}
