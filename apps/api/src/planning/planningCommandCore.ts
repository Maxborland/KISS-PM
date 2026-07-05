import { calculatePlan, reducePlanningCommand, type PlanningCommand, type PlanSnapshot, type ValidationIssue } from "@kiss-pm/domain";

import type { PlanningReadDataPort } from "../apiDataPorts";
import { PLANNING_ENGINE_VERSION } from "./planningConstants";
import { validateCommandDataSourcePreconditions } from "./planningRouteHelpers";

export function previewPlanningCommand(snapshot: PlanSnapshot, command: PlanningCommand) {
  const reduction = reducePlanningCommand(snapshot, command);
  const calculated = calculatePlan(reduction.nextSnapshot, {
    calculatedAt: snapshot.capturedAt,
    engineVersion: PLANNING_ENGINE_VERSION
  });
  return {
    ...reduction,
    validationIssues: [...reduction.validationIssues, ...calculated.validationIssues]
  };
}

export async function previewPlanningCommands(
  snapshot: PlanSnapshot,
  commands: PlanningCommand[],
  dataSource: PlanningReadDataPort,
  tenantId: string
) {
  let nextSnapshot = snapshot;
  let validationIssues: ValidationIssue[] = [];
  const changedTaskIds = new Set<string>();
  const changedAssignmentIds = new Set<string>();
  const changedDependencyIds = new Set<string>();
  const acceptedRiskIds = new Set<string>();

  for (const command of commands) {
    const preview = previewPlanningCommand(nextSnapshot, command);
    nextSnapshot = preview.nextSnapshot;
    validationIssues = [
      ...validationIssues,
      ...preview.validationIssues,
      ...(await validateCommandDataSourcePreconditions(dataSource, tenantId, command))
    ];
    preview.planDelta.changedTaskIds.forEach((id) => changedTaskIds.add(id));
    preview.planDelta.changedAssignmentIds.forEach((id) => changedAssignmentIds.add(id));
    preview.planDelta.changedDependencyIds.forEach((id) => changedDependencyIds.add(id));
    preview.planDelta.acceptedRiskIds.forEach((id) => acceptedRiskIds.add(id));
  }

  const calculated = calculatePlan(nextSnapshot, {
    calculatedAt: snapshot.capturedAt,
    engineVersion: PLANNING_ENGINE_VERSION
  });
  validationIssues = [...validationIssues, ...calculated.validationIssues];

  return {
    nextSnapshot,
    validationIssues,
    planDelta: {
      commands,
      changedTaskIds: [...changedTaskIds],
      changedAssignmentIds: [...changedAssignmentIds],
      changedDependencyIds: [...changedDependencyIds],
      acceptedRiskIds: [...acceptedRiskIds]
    }
  };
}
