import type { PolicyDecision } from "@kiss-pm/access-control";

import type { ApiTenantDataSource } from "../apiTypes";
import {
  appendPlanningAuditIfConfigured,
  type PlanningRouteDeps
} from "./planningRouteHelpers";

type ScenarioApplyAuditInput = {
  deps: PlanningRouteDeps;
  tenantId: string;
  actorUserId: string;
  projectId: string;
  scenarioRunId: string;
  clientPlanVersion: number;
  permissionResult: PolicyDecision;
  auditDataSource?: ApiTenantDataSource;
};

export function scenarioApplyAuditContext(input: Omit<ScenarioApplyAuditInput, "permissionResult">) {
  return input;
}

export async function appendScenarioApplyDeniedAudit(
  input: ScenarioApplyAuditInput & {
    commandType?: string;
    planVersion?: number;
  }
) {
  await appendPlanningAuditIfConfigured(input.deps, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actionType: "planning.scenario_denied",
    sourceWorkflow: "planning",
    sourceEntity: { type: "Project", id: input.projectId },
    commandInput: {
      scenarioRunId: input.scenarioRunId,
      clientPlanVersion: input.clientPlanVersion,
      ...(input.commandType ? { commandType: input.commandType } : {})
    },
    beforeState: input.planVersion === undefined ? null : { planVersion: input.planVersion },
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: { status: "denied", reason: input.permissionResult.reason }
  }, input.auditDataSource);
}

export async function appendScenarioApplyConflictAudit(
  input: ScenarioApplyAuditInput & {
    reason: string;
    currentPlanVersion: number;
  }
) {
  await appendPlanningAuditIfConfigured(input.deps, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actionType: "planning.scenario_apply_conflict",
    sourceWorkflow: "planning",
    sourceEntity: { type: "Project", id: input.projectId },
    commandInput: {
      scenarioRunId: input.scenarioRunId,
      clientPlanVersion: input.clientPlanVersion,
      reason: input.reason,
      currentPlanVersion: input.currentPlanVersion
    },
    beforeState: { planVersion: input.currentPlanVersion },
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: {
      status: "conflict",
      reason: input.reason,
      planVersion: input.currentPlanVersion
    }
  }, input.auditDataSource);
}