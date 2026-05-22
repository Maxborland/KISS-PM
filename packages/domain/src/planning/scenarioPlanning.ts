import { reducePlanningCommand } from "./commandReducer";
import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "./planningCommands";
import { buildResourceLoadMatrix, type ResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import type { CalculatedPlan, PlanSnapshot, ScenarioProfile } from "./types";

export type ScenarioTarget = {
  type: "resource_overload";
  resourceId: string;
  date: string;
  overloadMinutes: number;
  taskIds: string[];
};

export type ScenarioProposal = {
  id: string;
  profile: ScenarioProfile;
  conflictEffect: "accepted" | "reduced" | "removed";
  planDelta: PlanDelta;
  explainability: {
    finishDate: string | null;
    deadlineDeltaDays: number;
    overloadMinutes: number;
    overloadedResourceIds: string[];
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    dependencyWarnings: string[];
    requiredApprovals: string[];
    riskScore: number;
  };
};

export function proposePlanningScenarios(input: {
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  resourceLoad: ResourceLoadMatrix;
  target: ScenarioTarget;
}): ScenarioProposal[] {
  const overload = findTargetOverload(input.resourceLoad, input.target);
  if (!overload) return [];

  return [
    createProposal("aggressive", "accepted", input, [
      {
        type: "risk.accept_overload",
        payload: {
          overloadId: `${input.target.resourceId}:${input.target.date}`,
          acceptedRiskReason: "Scenario keeps current finish date and accepts visible overload"
        }
      }
    ]),
    createReassignmentProposal("balanced", "reduced", input),
    createReassignmentProposal("resilient", "removed", input)
  ].filter(isScenarioProposal);
}

export function applyPlanDeltaToSnapshot(
  snapshot: PlanSnapshot,
  planDelta: PlanDelta
): PlanSnapshot {
  return planDelta.commands.reduce(
    (current, command) => reducePlanningCommand(current, command).nextSnapshot,
    snapshot
  );
}

function createReassignmentProposal(
  profile: Extract<ScenarioProfile, "balanced" | "resilient">,
  effect: Extract<ScenarioProposal["conflictEffect"], "reduced" | "removed">,
  input: {
    snapshot: PlanSnapshot;
    calculatedPlan: CalculatedPlan;
    resourceLoad: ResourceLoadMatrix;
    target: ScenarioTarget;
  }
): ScenarioProposal | null {
  const targetBucket = findTargetBucket(input.resourceLoad, input.target);
  if (!targetBucket) return null;
  const taskId = targetBucket.taskIds[0] ?? input.target.taskIds[0];
  if (!taskId) return null;
  const targetAssignment = input.snapshot.assignments.find(
    (assignment) =>
      assignment.taskId === taskId &&
      assignment.resourceId === input.target.resourceId &&
      (assignment.role === "executor" || assignment.role === "co_executor")
  );
  if (!targetAssignment) return null;
  const alternateResource = input.snapshot.resources.find(
    (resource) => resource.id !== input.target.resourceId
  );
  if (!alternateResource) return null;

  const originalWork = targetAssignment.workMinutes ?? targetBucket.assignedMinutes;
  const desiredTargetWork = effect === "removed"
    ? Math.max(0, targetBucket.capacityMinutes - targetBucket.reservedMinutes)
    : Math.max(
        0,
        originalWork - Math.max(1, Math.floor(input.target.overloadMinutes / 2))
      );
  if (desiredTargetWork >= originalWork) return null;
  const movedWork = originalWork - desiredTargetWork;
  const commands: PlanningCommand[] = [
    {
      type: "assignment.upsert",
      payload: {
        id: targetAssignment.id,
        taskId,
        resourceId: targetAssignment.resourceId,
        role: targetAssignment.role,
        unitsPermille: targetAssignment.unitsPermille,
        workMinutes: desiredTargetWork
      }
    },
    {
      type: "assignment.upsert",
      payload: {
        id: `${targetAssignment.id}-${profile}-reassign`,
        taskId,
        resourceId: alternateResource.id,
        role: "co_executor",
        unitsPermille: 1000,
        workMinutes: movedWork
      }
    }
  ];

  const proposal = createProposal(profile, effect, input, commands);
  return proposalMatchesEffect(proposal, input) ? proposal : null;
}

function proposalMatchesEffect(
  proposal: ScenarioProposal,
  input: {
    snapshot: PlanSnapshot;
    target: ScenarioTarget;
  }
): boolean {
  if (proposal.conflictEffect === "accepted") {
    return proposal.planDelta.commands.some((command) => command.type === "risk.accept_overload");
  }

  const nextSnapshot = applyPlanDeltaToSnapshot(input.snapshot, proposal.planDelta);
  const nextPlan = calculatePlan(nextSnapshot, {
    calculatedAt: "2026-05-21T00:00:00.000Z",
    engineVersion: "planning-core-v1"
  });
  const rangeFinish = nextPlan.projectFinish ?? input.target.date;
  const nextResourceLoad = buildResourceLoadMatrix({
    plan: nextPlan,
    resources: nextSnapshot.resources,
    assignments: nextSnapshot.assignments,
    calendars: nextSnapshot.calendars,
    calendarExceptions: nextSnapshot.calendarExceptions,
    reservations: nextSnapshot.reservations,
    rangeStart: input.target.date,
    rangeFinish,
    granularities: ["day"]
  });
  const remaining = findTargetOverload(nextResourceLoad, input.target);

  if (proposal.conflictEffect === "removed") return !remaining;
  return Boolean(remaining && remaining.overloadMinutes < input.target.overloadMinutes);
}

function createProposal(
  profile: ScenarioProfile,
  conflictEffect: ScenarioProposal["conflictEffect"],
  input: {
    calculatedPlan: CalculatedPlan;
    resourceLoad: ResourceLoadMatrix;
    target: ScenarioTarget;
  },
  commands: PlanningCommand[]
): ScenarioProposal {
  const changedTaskIds = [
    ...new Set(
      commands.flatMap((command) =>
        "taskId" in command.payload ? [String(command.payload.taskId)] : []
      )
    )
  ].sort();
  const changedAssignmentIds = [
    ...new Set(
      commands.flatMap((command) => {
        if (command.type === "assignment.upsert") return [command.payload.id];
        if (command.type === "assignment.delete") return [command.payload.assignmentId];
        return [];
      })
    )
  ].sort();
  const planDelta: PlanDelta = {
    ...createEmptyPlanDelta(),
    commands,
    changedTaskIds,
    changedAssignmentIds,
    acceptedRiskIds: commands.flatMap((command) =>
      command.type === "risk.accept_overload" ? [command.payload.overloadId] : []
    )
  };
  const remainingOverloads = input.resourceLoad.overloads.filter(
    (overload) => overload.granularity === "day"
  );

  return {
    id: `scenario-${profile}-${input.target.resourceId}-${input.target.date}`,
    profile,
    conflictEffect,
    planDelta,
    explainability: {
      finishDate: input.calculatedPlan.projectFinish,
      deadlineDeltaDays: 0,
      overloadMinutes:
        conflictEffect === "accepted" ? input.target.overloadMinutes : Math.floor(input.target.overloadMinutes / 2),
      overloadedResourceIds: [...new Set(remainingOverloads.map((overload) => overload.resourceId))].sort(),
      changedTaskIds,
      changedAssignmentIds,
      dependencyWarnings: input.calculatedPlan.validationIssues
        .filter((issue) => issue.code === "dependency_cycle_detected")
        .map((issue) => issue.message),
      requiredApprovals:
        conflictEffect === "accepted" ? ["tenant.planning_scenarios.apply"] : [],
      riskScore: profile === "aggressive" ? 80 : profile === "balanced" ? 40 : 20
    }
  };
}

function findTargetBucket(resourceLoad: ResourceLoadMatrix, target: ScenarioTarget) {
  return resourceLoad.buckets.find(
    (bucket) =>
      bucket.granularity === "day" &&
      bucket.resourceId === target.resourceId &&
      bucket.date === target.date
  );
}

function findTargetOverload(resourceLoad: ResourceLoadMatrix, target: ScenarioTarget) {
  return resourceLoad.overloads.find(
    (overload) =>
      overload.granularity === "day" &&
      overload.resourceId === target.resourceId &&
      overload.date === target.date
  );
}

function isScenarioProposal(value: ScenarioProposal | null): value is ScenarioProposal {
  return value !== null;
}
