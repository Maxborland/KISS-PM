import { calculatePlan, reducePlanningCommand, type PlanningCommand, type PlanSnapshot, type ValidationIssue } from "@kiss-pm/domain";

import type { PlanningReadDataPort } from "../apiDataPorts";
import { PLANNING_ENGINE_VERSION } from "./planningConstants";
import { validateCommandDataSourcePreconditions } from "./planningRouteHelpers";

// Стабильный ключ issue для diff «до/после» (код + сущность).
function issueKey(issue: ValidationIssue): string {
  return `${issue.code}:${issue.entity?.type ?? ""}:${issue.entity?.id ?? ""}`;
}

// BUG-PROJ-23 (робастность): движковые issue считаем блокирующими ТОЛЬКО если их
// внесла ЭТА команда (diff before/after). Предсуществующие ошибки плана в несвязанной
// части не должны блокировать новую правку. Возвращаем внесённые + command-specific issue.
function introducedEngineIssues(before: PlanSnapshot, after: PlanSnapshot): ValidationIssue[] {
  const opts = { calculatedAt: before.capturedAt, engineVersion: PLANNING_ENGINE_VERSION } as const;
  const beforeKeys = new Set(calculatePlan(before, opts).validationIssues.map(issueKey));
  return calculatePlan(after, opts).validationIssues.filter((issue) => !beforeKeys.has(issueKey(issue)));
}

export function previewPlanningCommand(snapshot: PlanSnapshot, command: PlanningCommand) {
  const reduction = reducePlanningCommand(snapshot, command);
  return {
    ...reduction,
    validationIssues: [
      ...reduction.validationIssues,
      ...introducedEngineIssues(snapshot, reduction.nextSnapshot)
    ]
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
    // Только command-specific issue (reduction + precondition); движковые считаем ниже
    // как net-diff по всему пакету, чтобы предошибки плана не блокировали пакет (BUG-PROJ-23).
    const reduction = reducePlanningCommand(nextSnapshot, command);
    nextSnapshot = reduction.nextSnapshot;
    validationIssues = [
      ...validationIssues,
      ...reduction.validationIssues,
      ...(await validateCommandDataSourcePreconditions(dataSource, tenantId, command))
    ];
    reduction.planDelta.changedTaskIds.forEach((id) => changedTaskIds.add(id));
    reduction.planDelta.changedAssignmentIds.forEach((id) => changedAssignmentIds.add(id));
    reduction.planDelta.changedDependencyIds.forEach((id) => changedDependencyIds.add(id));
    reduction.planDelta.acceptedRiskIds.forEach((id) => acceptedRiskIds.add(id));
  }

  // Движковые issue, ВНЕСЁННЫЕ пакетом (net diff исходного снапшота и итогового).
  validationIssues = [...validationIssues, ...introducedEngineIssues(snapshot, nextSnapshot)];

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
