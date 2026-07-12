import { comparePlanDates, diffCalendarDays } from "./calendar";
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

export type ScenarioUnavailableReason =
  | "target_bucket_not_found"
  | "target_assignment_not_found"
  | "no_eligible_alternate_resource"
  | "alternate_resource_has_insufficient_capacity";

export type ScenarioProposal = {
  id: string;
  profile: ScenarioProfile;
  availability: "available" | "unavailable";
  unavailableReason: ScenarioUnavailableReason | null;
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
  ];
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
): ScenarioProposal {
  const targetBucket = findTargetBucket(input.resourceLoad, input.target);
  if (!targetBucket) return createUnavailableProposal(profile, effect, input, "target_bucket_not_found");
  const targetTaskIds = new Set(
    targetBucket.taskIds.length > 0 ? targetBucket.taskIds : input.target.taskIds
  );
  const targetAssignments = input.snapshot.assignments
    .filter(
      (assignment) =>
        targetTaskIds.has(assignment.taskId) &&
        assignment.resourceId === input.target.resourceId &&
        (assignment.role === "executor" || assignment.role === "co_executor")
    )
    .sort(
      (left, right) =>
        left.taskId.localeCompare(right.taskId) || left.id.localeCompare(right.id)
    );
  if (targetAssignments.length === 0) {
    return createUnavailableProposal(profile, effect, input, "target_assignment_not_found");
  }
  const targetResource = input.snapshot.resources.find(
    (resource) => resource.id === input.target.resourceId
  );
  const eligible = input.snapshot.resources
    .filter(
      (resource) =>
        resource.id !== input.target.resourceId &&
        (targetResource?.positionId ? resource.positionId === targetResource.positionId : true)
    )
    .map((resource) => ({
      resource,
      spareMinutes: resourceSpareMinutes(input.resourceLoad, resource.id, input.target.date)
    }))
    .sort(
      (left, right) =>
        right.spareMinutes - left.spareMinutes ||
        left.resource.id.localeCompare(right.resource.id)
    );
  if (eligible.length === 0) {
    return createUnavailableProposal(profile, effect, input, "no_eligible_alternate_resource");
  }

  const totalSourceWork = targetAssignments.reduce(
    (total, assignment) =>
      total +
      (assignment.workMinutes ??
        (targetAssignments.length === 1 ? targetBucket.assignedMinutes : 0)),
    0
  );
  const requestedMove =
    effect === "removed"
      ? input.target.overloadMinutes
      : Math.max(1, Math.floor(input.target.overloadMinutes / 2));
  const movedWork = Math.min(totalSourceWork, requestedMove);
  if (movedWork <= 0) {
    return createUnavailableProposal(
      profile,
      effect,
      input,
      "alternate_resource_has_insufficient_capacity"
    );
  }

  let remainingMove = movedWork;
  const sources = targetAssignments.flatMap((assignment) => {
    if (remainingMove <= 0) return [];
    const originalWork =
      assignment.workMinutes ??
      (targetAssignments.length === 1 ? targetBucket.assignedMinutes : 0);
    const moved = Math.min(originalWork, remainingMove);
    remainingMove -= moved;
    return moved > 0 ? [{ assignment, originalWork, moved }] : [];
  });
  if (remainingMove > 0) {
    return createUnavailableProposal(
      profile,
      effect,
      input,
      "alternate_resource_has_insufficient_capacity"
    );
  }
  for (const candidate of eligible) {
    if (candidate.spareMinutes < movedWork) continue;
    const commands: PlanningCommand[] = [];
    for (const source of sources) {
      const assignment = source.assignment;
      commands.push(
        {
          type: "assignment.upsert",
          payload: {
            id: assignment.id,
            taskId: assignment.taskId,
            resourceId: assignment.resourceId,
            role: assignment.role,
            unitsPermille: assignment.unitsPermille,
            workMinutes: source.originalWork - source.moved
          }
        },
        {
          type: "assignment.upsert",
          payload: {
            id: `${assignment.id}-${profile}-reassign`,
            taskId: assignment.taskId,
            resourceId: candidate.resource.id,
            role: "co_executor",
            unitsPermille: 1000,
            workMinutes: source.moved
          }
        }
      );
    }

    const provisionalProposal = createProposal(profile, effect, input, commands);
    const evaluation = evaluateProposalEffect(input, provisionalProposal.planDelta);
    const proposal = createProposal(
      profile,
      effect,
      {
        ...input,
        calculatedPlan: evaluation.calculatedPlan,
        resourceLoad: evaluation.resourceLoad
      },
      commands
    );
    if (proposalMatchesEffect(proposal, input, evaluation.resourceLoad)) return proposal;
  }

  return createUnavailableProposal(
    profile,
    effect,
    input,
    "alternate_resource_has_insufficient_capacity"
  );
}

function createUnavailableProposal(
  profile: Extract<ScenarioProfile, "balanced" | "resilient">,
  effect: Extract<ScenarioProposal["conflictEffect"], "reduced" | "removed">,
  input: {
    snapshot: PlanSnapshot;
    calculatedPlan: CalculatedPlan;
    resourceLoad: ResourceLoadMatrix;
    target: ScenarioTarget;
  },
  unavailableReason: ScenarioUnavailableReason
): ScenarioProposal {
  return {
    ...createProposal(profile, effect, input, []),
    availability: "unavailable",
    unavailableReason
  };
}

function resourceSpareMinutes(
  resourceLoad: ResourceLoadMatrix,
  resourceId: string,
  date: string
): number {
  const bucket = resourceLoad.buckets.find(
    (candidate) =>
      candidate.granularity === "day" &&
      candidate.resourceId === resourceId &&
      candidate.date === date
  );
  if (!bucket) return 0;
  return Math.max(
    0,
    bucket.capacityMinutes - bucket.reservedMinutes - bucket.assignedMinutes
  );
}
function evaluateProposalEffect(
  input: {
    snapshot: PlanSnapshot;
    target: ScenarioTarget;
  },
  planDelta: PlanDelta
): { calculatedPlan: CalculatedPlan; resourceLoad: ResourceLoadMatrix } {
  const nextSnapshot = applyPlanDeltaToSnapshot(input.snapshot, planDelta);
  const calculatedPlan = calculatePlan(nextSnapshot, {
    calculatedAt: "2026-05-21T00:00:00.000Z",
    engineVersion: "planning-core-v1"
  });
  const rangeFinish = calculatedPlan.projectFinish ?? input.target.date;
  const resourceLoad = buildResourceLoadMatrix({
    plan: calculatedPlan,
    resources: nextSnapshot.resources,
    assignments: nextSnapshot.assignments,
    assignmentAllocations: nextSnapshot.assignmentAllocations,
    calendars: nextSnapshot.calendars,
    calendarExceptions: nextSnapshot.calendarExceptions,
    reservations: nextSnapshot.reservations,
    rangeStart: input.target.date,
    rangeFinish,
    granularities: ["day"]
  });

  return { calculatedPlan, resourceLoad };
}

function proposalMatchesEffect(
  proposal: ScenarioProposal,
  input: {
    resourceLoad: ResourceLoadMatrix;
    target: ScenarioTarget;
  },
  nextResourceLoad: ResourceLoadMatrix
): boolean {
  if (proposal.conflictEffect === "accepted") {
    return proposal.planDelta.commands.some((command) => command.type === "risk.accept_overload");
  }

  const remaining = findTargetOverload(nextResourceLoad, input.target);
  const originalDayOverload = sumDayOverload(input.resourceLoad, input.target.date);
  const nextDayOverload = sumDayOverload(nextResourceLoad, input.target.date);

  if (proposal.conflictEffect === "removed") return !remaining && nextDayOverload === 0;
  return Boolean(
    remaining &&
    remaining.overloadMinutes < input.target.overloadMinutes &&
    nextDayOverload < originalDayOverload
  );
}

function createProposal(
  profile: ScenarioProfile,
  conflictEffect: ScenarioProposal["conflictEffect"],
  input: {
    snapshot: PlanSnapshot;
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
  // Честная дельта к дедлайну: прогнозный финиш профиля против дедлайна проекта
  // (0 — если финиш не позже дедлайна или одна из дат отсутствует). Семантика как
  // deadlineMissDays в autoSolver — «на сколько календарных дней профиль срывает дедлайн».
  const finishDate = input.calculatedPlan.projectFinish;
  const deadline = input.snapshot.project.deadline;
  const deadlineDeltaDays =
    finishDate && deadline && comparePlanDates(finishDate, deadline) > 0
      ? diffCalendarDays(deadline, finishDate)
      : 0;

  return {
    id: `scenario-${profile}-${input.target.resourceId}-${input.target.date}`,
    profile,
    availability: "available",
    unavailableReason: null,
    conflictEffect,
    planDelta,
    explainability: {
      finishDate,
      deadlineDeltaDays,
      overloadMinutes: sumDayOverload(input.resourceLoad, input.target.date),
      overloadedResourceIds: [...new Set(remainingOverloads.map((overload) => overload.resourceId))].sort(),
      changedTaskIds,
      changedAssignmentIds,
      dependencyWarnings: input.calculatedPlan.validationIssues
        .filter((issue) => issue.code === "dependency_cycle_detected")
        .map((issue) => issue.message),
      requiredApprovals:
        conflictEffect === "accepted" ? ["tenant.planning_scenarios.apply"] : [],
      // riskScore СОЗНАТЕЛЬНО остаётся профильной константой (80/40/20): UI-чипы
      // «высокий/средний/низкий риск» и выбор «рекомендуется» (минимальный score среди
      // доступных) прибиты e2e к этим порогам. Честная модель риска — отдельная задача.
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

function sumDayOverload(resourceLoad: ResourceLoadMatrix, date: string): number {
  return resourceLoad.overloads
    .filter((overload) => overload.granularity === "day" && overload.date === date)
    .reduce((total, overload) => total + overload.overloadMinutes, 0);
}

