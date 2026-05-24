import { addDays, comparePlanDates, diffCalendarDays } from "./calendar";
import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "./planningCommands";
import { getTopologicalTaskOrder } from "./dependencyGraph";
import { buildResourceLoadMatrix, type ResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import { applyPlanDeltaToSnapshot } from "./scenarioPlanning";
import type { CalculatedPlan, CalculatedTask, PlanAssignment, PlanDate, PlanDependency, PlanSnapshot } from "./types";

export type AutoPlanningSolverMode = "schedule" | "repair";

export type AutoPlanningSolverProposal = {
  id: string;
  mode: AutoPlanningSolverMode;
  label: string;
  conflictEffect: "removed" | "accepted_overload";
  planDelta: PlanDelta;
  explainability: {
    finishDate: PlanDate | null;
    deadlineDeltaDays: number;
    overloadMinutes: number;
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    acceptedRiskIds: string[];
    riskScore: number;
    cost: number;
    reason: string;
  };
};

export type AutoPlanningSolverRunResult = {
  mode: AutoPlanningSolverMode;
  planVersion: number;
  engineVersion: string;
  calculatedAt: string;
  search: {
    strategy: "bounded_beam";
    beamWidth: number;
    maxIterations: number;
    maxProposals: number;
  };
  proposals: AutoPlanningSolverProposal[];
};

export type AutoPlanningSolverInput = {
  mode: AutoPlanningSolverMode;
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  resourceLoad: ResourceLoadMatrix;
  calculatedAt: string;
  beamWidth?: number;
  maxIterations?: number;
  maxProposals?: number;
};

export type ResourceCapacityProvider = (resourceId: string, date: PlanDate) => number | undefined;
export type ResourceOccupationProvider = (resourceId: string, date: PlanDate) => number | undefined;

type AssignmentPlan = {
  assignment: PlanAssignment;
  sourceAssignmentId: string;
  isNewAssignment: boolean;
  workMinutes: number;
  allocations: Array<{ date: PlanDate; workMinutes: number }>;
};

type SolverAssignment = {
  assignment: PlanAssignment;
  task: CalculatedTask;
  requiredWork: number;
};

type SearchState = {
  id: string;
  nextIndex: number;
  capacityByResourceDate: Map<string, number>;
  plans: AssignmentPlan[];
  overloadedMinutes: number;
  changedAssignmentIds: Set<string>;
  operationKinds: string[];
  lastAllocationDate: PlanDate | null;
};

export function proposeAutoPlanningSolutions(input: AutoPlanningSolverInput): AutoPlanningSolverRunResult {
  const beamWidth = input.beamWidth ?? 20;
  const maxIterations = input.maxIterations ?? 200;
  const maxProposals = input.maxProposals ?? 5;
  const proposals = [
    createAllocationProposal(input, "removed"),
    createAllocationProposal(input, "accepted_overload")
  ]
    .filter((proposal): proposal is AutoPlanningSolverProposal => Boolean(proposal))
    .sort((left, right) => left.explainability.cost - right.explainability.cost || left.id.localeCompare(right.id))
    .slice(0, maxProposals);

  return {
    mode: input.mode,
    planVersion: input.snapshot.planVersion,
    engineVersion: input.calculatedPlan.engineVersion,
    calculatedAt: input.calculatedAt,
    search: {
      strategy: "bounded_beam",
      beamWidth,
      maxIterations,
      maxProposals
    },
    proposals
  };
}

function createAllocationProposal(
  input: AutoPlanningSolverInput,
  conflictEffect: AutoPlanningSolverProposal["conflictEffect"]
): AutoPlanningSolverProposal | null {
  const plans = planAssignmentAllocations(input, conflictEffect === "accepted_overload");
  if (!plans) return null;
  const commands = commandsForAssignmentPlans(input, plans);
  if (conflictEffect === "accepted_overload") {
    commands.push({
      type: "risk.accept_overload",
      payload: {
        overloadId: `auto-solver:${input.snapshot.projectId}:${input.snapshot.planVersion}`,
        acceptedRiskReason: "Auto-solver could not meet the deadline without controlled overload"
      }
    });
  }
  if (commands.length === 0) return null;
  const planDelta = planDeltaFor(commands);
  const evaluated = evaluateDelta(input, planDelta);
  const overloadMinutes = evaluated.resourceLoad.overloads
    .filter((overload) => overload.granularity === "day")
    .reduce((total, overload) => total + overload.overloadMinutes, 0);
  if (conflictEffect === "removed" && overloadMinutes > 0) return null;
  if (conflictEffect === "accepted_overload" && overloadMinutes === 0) return null;
  const finishDate = latestPlanDate([
    evaluated.calculatedPlan.projectFinish,
    latestPlanDate(plans.flatMap((plan) => plan.allocations.map((allocation) => allocation.date)))
  ]);
  const deadlineDeltaDays = deadlineMissDays(input.snapshot.project.deadline, finishDate);
  const acceptedRiskIds = planDelta.acceptedRiskIds;
  const riskScore = conflictEffect === "accepted_overload" ? 90 : 20;
  const changedTaskIds = planDelta.changedTaskIds;
  const changedAssignmentIds = planDelta.changedAssignmentIds;

  return {
    id: `auto-solver-${input.mode}-${conflictEffect}-${input.snapshot.projectId}-${input.snapshot.planVersion}`,
    mode: input.mode,
    label:
      conflictEffect === "removed"
        ? "Перераспределить работу без перегрузов"
        : "Уложиться в срок с управляемым перегрузом",
    conflictEffect,
    planDelta,
    explainability: {
      finishDate,
      deadlineDeltaDays,
      overloadMinutes,
      changedTaskIds,
      changedAssignmentIds,
      acceptedRiskIds,
      riskScore,
      cost: proposalCost({
        deadlineDeltaDays,
        finishDate,
        projectStart: input.snapshot.project.plannedStart,
        overloadMinutes,
        changedCount: changedTaskIds.length + changedAssignmentIds.length,
        riskScore
      }),
      reason:
        conflictEffect === "removed"
          ? "Solver allocates assignment work into daily free capacity before accepting overload"
          : "Solver preserves deadline priority and exposes remaining overload as an explicit risk"
    }
  };
}

function planAssignmentAllocations(
  input: AutoPlanningSolverInput,
  allowOverload: boolean
): AssignmentPlan[] | null {
  const solverAssignments = buildSolverAssignments(input);
  const solvableAssignmentIds = new Set(solverAssignments.map((solverAssignment) => solverAssignment.assignment.id));
  const lockedOccupation = buildLockedOccupationProvider(input, solvableAssignmentIds);
  const initialState: SearchState = {
    id: "root",
    nextIndex: 0,
    capacityByResourceDate: buildAvailableCapacityMap(input, lockedOccupation),
    plans: [],
    overloadedMinutes: 0,
    changedAssignmentIds: new Set(),
    operationKinds: [],
    lastAllocationDate: null
  };
  let beam: SearchState[] = [initialState];
  const beamWidth = Math.max(1, input.beamWidth ?? 20);
  const maxIterations = Math.max(1, input.maxIterations ?? 200);
  let iterations = 0;

  while (beam.some((state) => state.nextIndex < solverAssignments.length) && iterations < maxIterations) {
    const expanded: SearchState[] = [];
    for (const state of beam) {
      if (state.nextIndex >= solverAssignments.length) {
        expanded.push(state);
        continue;
      }
      iterations += 1;
      expanded.push(
        ...expandAssignmentState(input, state, solverAssignments[state.nextIndex], allowOverload)
      );
      if (iterations >= maxIterations) break;
    }
    if (expanded.length === 0) return null;
    beam = pruneEquivalentStates(expanded)
      .sort((left, right) => compareSearchStates(input, left, right))
      .slice(0, beamWidth);
  }

  const completed = beam
    .filter((state) => state.nextIndex >= solverAssignments.length)
    .sort((left, right) => compareSearchStates(input, left, right));
  return completed[0]?.plans ?? null;
}

function commandsForAssignmentPlans(input: AutoPlanningSolverInput, plans: AssignmentPlan[]): PlanningCommand[] {
  const commands: PlanningCommand[] = [];
  for (const taskPatch of taskSchedulePatchesForPlans(input, plans)) {
    commands.push({
      type: "task.update_schedule",
      payload: taskPatch
    });
  }
  const sourceAssignmentIds = new Set(plans.map((plan) => plan.sourceAssignmentId));
  for (const sourceAssignmentId of sourceAssignmentIds) {
    if (!plans.some((plan) => plan.assignment.id === sourceAssignmentId)) {
      commands.push({
        type: "assignment.delete",
        payload: { assignmentId: sourceAssignmentId }
      });
    }
  }
  for (const plan of plans) {
    commands.push({
      type: "assignment.upsert",
      payload: {
        id: plan.assignment.id,
        taskId: plan.assignment.taskId,
        resourceId: plan.assignment.resourceId,
        role: plan.assignment.role,
        unitsPermille: plan.assignment.unitsPermille,
        workMinutes: plan.workMinutes
      }
    });
    commands.push({
      type: "assignment.allocations.replace",
      payload: {
        assignmentId: plan.assignment.id,
        allocations: mergeAllocations(plan.allocations)
      }
    });
  }
  return commands;
}

function buildSolverAssignments(input: AutoPlanningSolverInput): SolverAssignment[] {
  const taskOrder = new Map(
    getTopologicalTaskOrder(
      input.snapshot.tasks.map((task) => task.id),
      input.snapshot.dependencies
    ).map((taskId, index) => [taskId, index])
  );
  return input.snapshot.assignments
    .filter(isWorkAssignment)
    .flatMap((assignment) => {
      const task = input.calculatedPlan.tasks.find((candidate) => candidate.id === assignment.taskId);
      if (!task || !shouldSolveTask(input.mode, task)) return [];
      const requiredWork = resolveAssignmentWork(input.snapshot.assignments, assignment, task.workMinutes);
      if (requiredWork <= 0) return [];
      return [{ assignment, task, requiredWork }];
    })
    .sort((left, right) =>
      (taskOrder.get(left.task.id) ?? Number.MAX_SAFE_INTEGER) -
        (taskOrder.get(right.task.id) ?? Number.MAX_SAFE_INTEGER) ||
      comparePlanDates(
        left.task.calculatedStart ?? input.snapshot.project.plannedStart,
        right.task.calculatedStart ?? input.snapshot.project.plannedStart
      ) ||
      comparePlanDates(
        left.task.calculatedFinish ?? input.snapshot.project.plannedFinish,
        right.task.calculatedFinish ?? input.snapshot.project.plannedFinish
      ) ||
      left.task.wbsCode.localeCompare(right.task.wbsCode, undefined, { numeric: true }) ||
      left.assignment.id.localeCompare(right.assignment.id)
    );
}

function buildAvailableCapacityMap(
  input: AutoPlanningSolverInput,
  lockedOccupation: ResourceOccupationProvider
): Map<string, number> {
  const capacityByResourceDate = new Map<string, number>();
  for (const bucket of input.resourceLoad.buckets.filter((item) => item.granularity === "day")) {
    capacityByResourceDate.set(
      resourceDateKey(bucket.resourceId, bucket.date),
      Math.max(
        0,
        bucket.capacityMinutes -
          bucket.reservedMinutes -
          (lockedOccupation(bucket.resourceId, bucket.date) ?? 0)
      )
    );
  }
  return capacityByResourceDate;
}

function expandAssignmentState(
  input: AutoPlanningSolverInput,
  state: SearchState,
  solverAssignment: SolverAssignment | undefined,
  allowOverload: boolean
): SearchState[] {
  if (!solverAssignment) return [{ ...state, nextIndex: state.nextIndex + 1 }];
  const candidateResources = orderedCandidateResources(input, solverAssignment.assignment);
  const dates = allocationDatesForTask(
    input,
    state,
    solverAssignment,
    solverAssignment.task.calculatedStart ?? input.snapshot.project.plannedStart
  );
  const candidates: SearchState[] = [];

  for (const resourceId of candidateResources) {
    const singleResource = allocateAcrossResources({
      source: solverAssignment,
      resourceIds: [resourceId],
      dates,
      capacityByResourceDate: state.capacityByResourceDate,
      allowOverload: false
    });
    if (singleResource) {
      candidates.push(appendAllocationCandidate(state, solverAssignment, singleResource, "single"));
    }
  }

  const split = allocateAcrossResources({
    source: solverAssignment,
    resourceIds: candidateResources,
    dates,
    capacityByResourceDate: state.capacityByResourceDate,
    allowOverload: false
  });
  if (split && split.plans.length > 1) {
    candidates.push(appendAllocationCandidate(state, solverAssignment, split, "split"));
  }

  if (allowOverload) {
    const overload = allocateAcrossResources({
      source: solverAssignment,
      resourceIds: [solverAssignment.assignment.resourceId, ...candidateResources.filter((id) => id !== solverAssignment.assignment.resourceId)],
      dates,
      capacityByResourceDate: state.capacityByResourceDate,
      allowOverload: true
    });
    if (overload) {
      candidates.push(appendAllocationCandidate(state, solverAssignment, overload, "overload"));
    }
  }

  return pruneEquivalentStates(candidates).sort((left, right) => compareSearchStates(input, left, right));
}

function allocateAcrossResources(input: {
  source: SolverAssignment;
  resourceIds: string[];
  dates: PlanDate[];
  capacityByResourceDate: Map<string, number>;
  allowOverload: boolean;
}): {
  capacityByResourceDate: Map<string, number>;
  plans: AssignmentPlan[];
  overloadedMinutes: number;
  lastAllocationDate: PlanDate | null;
} | null {
  const nextCapacity = new Map(input.capacityByResourceDate);
  const plans: AssignmentPlan[] = [];
  let remainingWork = input.source.requiredWork;
  let overloadedMinutes = 0;
  let lastAllocationDate: PlanDate | null = null;

  for (const resourceId of input.resourceIds) {
    if (remainingWork <= 0) break;
    const allocations: Array<{ date: PlanDate; workMinutes: number }> = [];
    for (const date of input.dates) {
      if (remainingWork <= 0) break;
      const key = resourceDateKey(resourceId, date);
      const available = nextCapacity.get(key) ?? 0;
      if (available <= 0) continue;
      const workMinutes = Math.min(remainingWork, available);
      nextCapacity.set(key, available - workMinutes);
      remainingWork -= workMinutes;
      allocations.push({ date, workMinutes });
      lastAllocationDate = latestPlanDate([lastAllocationDate, date]);
    }
    const workMinutes = allocations.reduce((total, allocation) => total + allocation.workMinutes, 0);
    if (workMinutes > 0) {
      plans.push(toAssignmentPlan(input.source.assignment, resourceId, workMinutes, allocations));
    }
  }

  if (remainingWork > 0) {
    if (!input.allowOverload) return null;
    const overloadDate = input.dates[0];
    const overloadResourceId = input.source.assignment.resourceId;
    if (!overloadDate) return null;
    overloadedMinutes += remainingWork;
    const existingPlan = plans.find((plan) => plan.assignment.resourceId === overloadResourceId);
    if (existingPlan) {
      existingPlan.allocations.push({ date: overloadDate, workMinutes: remainingWork });
      existingPlan.workMinutes += remainingWork;
      existingPlan.assignment.workMinutes = existingPlan.workMinutes;
    } else {
      plans.push(
        toAssignmentPlan(input.source.assignment, overloadResourceId, remainingWork, [
          { date: overloadDate, workMinutes: remainingWork }
        ])
      );
    }
    const key = resourceDateKey(overloadResourceId, overloadDate);
    nextCapacity.set(key, (nextCapacity.get(key) ?? 0) - remainingWork);
    lastAllocationDate = latestPlanDate([lastAllocationDate, overloadDate]);
  }

  return {
    capacityByResourceDate: nextCapacity,
    plans,
    overloadedMinutes,
    lastAllocationDate
  };
}

function appendAllocationCandidate(
  state: SearchState,
  solverAssignment: SolverAssignment,
  candidate: {
    capacityByResourceDate: Map<string, number>;
    plans: AssignmentPlan[];
    overloadedMinutes: number;
    lastAllocationDate: PlanDate | null;
  },
  operationKind: string
): SearchState {
  const changedAssignmentIds = new Set(state.changedAssignmentIds);
  for (const plan of candidate.plans) {
    if (
      plan.assignment.id !== solverAssignment.assignment.id ||
      plan.assignment.resourceId !== solverAssignment.assignment.resourceId ||
      plan.workMinutes !== (solverAssignment.assignment.workMinutes ?? solverAssignment.requiredWork)
    ) {
      changedAssignmentIds.add(solverAssignment.assignment.id);
      changedAssignmentIds.add(plan.assignment.id);
    }
  }
  if (!candidate.plans.some((plan) => plan.assignment.id === solverAssignment.assignment.id)) {
    changedAssignmentIds.add(solverAssignment.assignment.id);
  }

  return {
    id: [
      state.id,
      operationKind,
      candidate.plans
        .map((plan) => `${plan.assignment.id}:${plan.assignment.resourceId}:${plan.workMinutes}`)
        .join(",")
    ].join(">"),
    nextIndex: state.nextIndex + 1,
    capacityByResourceDate: candidate.capacityByResourceDate,
    plans: [...state.plans, ...candidate.plans],
    overloadedMinutes: state.overloadedMinutes + candidate.overloadedMinutes,
    changedAssignmentIds,
    operationKinds: [...state.operationKinds, operationKind],
    lastAllocationDate: latestPlanDate([state.lastAllocationDate, candidate.lastAllocationDate])
  };
}

function toAssignmentPlan(
  source: PlanAssignment,
  resourceId: string,
  workMinutes: number,
  allocations: Array<{ date: PlanDate; workMinutes: number }>
): AssignmentPlan {
  return {
    assignment: {
      ...source,
      id: resourceId === source.resourceId ? source.id : `${source.id}-solver-${resourceId}`,
      resourceId,
      role: resourceId === source.resourceId ? source.role : "co_executor",
      workMinutes
    },
    sourceAssignmentId: source.id,
    isNewAssignment: resourceId !== source.resourceId,
    workMinutes,
    allocations
  };
}

function pruneEquivalentStates(states: SearchState[]): SearchState[] {
  const byKey = new Map<string, SearchState>();
  for (const state of states) {
    const key = [
      state.nextIndex,
      state.plans
        .map((plan) => `${plan.assignment.id}:${plan.assignment.resourceId}:${mergeAllocations(plan.allocations).map((allocation) => `${allocation.date}:${allocation.workMinutes}`).join(",")}`)
        .sort()
        .join("|")
    ].join("::");
    const existing = byKey.get(key);
    if (!existing || state.overloadedMinutes < existing.overloadedMinutes || state.id.localeCompare(existing.id) < 0) {
      byKey.set(key, state);
    }
  }
  return [...byKey.values()];
}

function compareSearchStates(input: AutoPlanningSolverInput, left: SearchState, right: SearchState): number {
  return (
    deadlineMissDays(input.snapshot.project.deadline, left.lastAllocationDate) -
      deadlineMissDays(input.snapshot.project.deadline, right.lastAllocationDate) ||
    compareNullableDates(left.lastAllocationDate, right.lastAllocationDate) ||
    left.overloadedMinutes - right.overloadedMinutes ||
    left.changedAssignmentIds.size - right.changedAssignmentIds.size ||
    operationRisk(left.operationKinds) - operationRisk(right.operationKinds) ||
    left.id.localeCompare(right.id)
  );
}

function taskSchedulePatchesForPlans(
  input: AutoPlanningSolverInput,
  plans: AssignmentPlan[]
): Array<{ taskId: string; plannedStart: PlanDate | null; plannedFinish: PlanDate | null }> {
  const datesByTaskId = new Map<string, PlanDate[]>();
  for (const plan of plans) {
    datesByTaskId.set(plan.assignment.taskId, [
      ...(datesByTaskId.get(plan.assignment.taskId) ?? []),
      ...plan.allocations.map((allocation) => allocation.date)
    ]);
  }

  return [...datesByTaskId.entries()].flatMap(([taskId, dates]) => {
    const sortedDates = [...new Set(dates)].sort((left, right) => left.localeCompare(right));
    const plannedStart = sortedDates[0];
    const plannedFinish = sortedDates.at(-1);
    const task = input.snapshot.tasks.find((candidate) => candidate.id === taskId);
    if (!task || !plannedStart || !plannedFinish) return [];
    if (task.plannedStart === plannedStart && task.plannedFinish === plannedFinish) return [];
    return [{ taskId, plannedStart, plannedFinish }];
  });
}

function evaluateDelta(input: AutoPlanningSolverInput, planDelta: PlanDelta) {
  const snapshot = applyPlanDeltaToSnapshot(input.snapshot, planDelta);
  const calculatedPlan = calculatePlan(snapshot, {
    calculatedAt: input.calculatedAt,
    engineVersion: input.calculatedPlan.engineVersion
  });
  const resourceLoad = buildResourceLoadMatrix({
    plan: calculatedPlan,
    resources: snapshot.resources,
    assignments: snapshot.assignments,
    assignmentAllocations: snapshot.assignmentAllocations,
    calendars: snapshot.calendars,
    calendarExceptions: snapshot.calendarExceptions,
    reservations: snapshot.reservations,
    rangeStart: snapshot.project.plannedStart,
    rangeFinish:
      latestPlanDate([
        calculatedPlan.projectFinish,
        snapshot.project.plannedFinish,
        latestPlanDate((snapshot.assignmentAllocations ?? []).map((allocation) => allocation.date))
      ]) ?? snapshot.project.plannedFinish,
    granularities: ["day"]
  });
  return { calculatedPlan, resourceLoad };
}

function planDeltaFor(commands: PlanningCommand[]): PlanDelta {
  return {
    ...createEmptyPlanDelta(),
    commands,
    changedTaskIds: [
      ...new Set(commands.flatMap((command) => ("taskId" in command.payload ? [String(command.payload.taskId)] : [])))
    ].sort(),
    changedAssignmentIds: [
      ...new Set(
        commands.flatMap((command) => {
          if (command.type === "assignment.upsert") return [command.payload.id];
          if (command.type === "assignment.allocations.replace") return [command.payload.assignmentId];
          if (command.type === "assignment.delete") return [command.payload.assignmentId];
          return [];
        })
      )
    ].sort(),
    acceptedRiskIds: commands.flatMap((command) =>
      command.type === "risk.accept_overload" ? [command.payload.overloadId] : []
    )
  };
}

function orderedCandidateResources(input: AutoPlanningSolverInput, assignment: PlanAssignment): string[] {
  const assignedResource = input.snapshot.resources.find((resource) => resource.id === assignment.resourceId);
  return input.snapshot.resources
    .filter(
      (resource) =>
        resource.id === assignment.resourceId ||
        !assignedResource ||
        resource.positionId === assignedResource.positionId ||
        resource.teamId === assignedResource.teamId
    )
    .sort((left, right) =>
      Number(right.id === assignment.resourceId) - Number(left.id === assignment.resourceId) ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    )
    .map((resource) => resource.id);
}

function buildLockedOccupationProvider(
  input: AutoPlanningSolverInput,
  solvableAssignmentIds: Set<string>
): ResourceOccupationProvider {
  const lockedAssignments = input.snapshot.assignments.filter(
    (assignment) => isWorkAssignment(assignment) && !solvableAssignmentIds.has(assignment.id)
  );
  if (lockedAssignments.length === 0) return () => 0;

  const lockedAssignmentIds = new Set(lockedAssignments.map((assignment) => assignment.id));
  const lockedLoad = buildResourceLoadMatrix({
    plan: input.calculatedPlan,
    resources: input.snapshot.resources,
    assignments: lockedAssignments,
    assignmentAllocations: (input.snapshot.assignmentAllocations ?? []).filter((allocation) =>
      lockedAssignmentIds.has(allocation.assignmentId)
    ),
    calendars: input.snapshot.calendars,
    calendarExceptions: input.snapshot.calendarExceptions,
    reservations: [],
    rangeStart: input.snapshot.project.plannedStart,
    rangeFinish: input.snapshot.project.deadline ?? input.snapshot.project.plannedFinish,
    granularities: ["day"]
  });
  const occupationByResourceDate = new Map<string, number>();
  for (const bucket of lockedLoad.buckets.filter((item) => item.granularity === "day")) {
    occupationByResourceDate.set(
      resourceDateKey(bucket.resourceId, bucket.date),
      (occupationByResourceDate.get(resourceDateKey(bucket.resourceId, bucket.date)) ?? 0) +
        bucket.assignedMinutes
    );
  }
  return (resourceId, date) => occupationByResourceDate.get(resourceDateKey(resourceId, date)) ?? 0;
}

function shouldSolveTask(mode: AutoPlanningSolverMode, task: CalculatedTask): boolean {
  if (mode === "repair" && task.percentComplete >= 100) return false;
  return true;
}

function allocationDatesForTask(
  input: AutoPlanningSolverInput,
  state: SearchState,
  solverAssignment: SolverAssignment,
  authoredStart: PlanDate
): PlanDate[] {
  const start = latestPlanDate([
    authoredStart,
    dependencyConstrainedAllocationStart(input, state.plans, solverAssignment)
  ]) ?? authoredStart;
  const finish = input.snapshot.project.deadline ?? input.snapshot.project.plannedFinish;
  const dayCount = Math.max(0, diffCalendarDays(start, finish));
  return Array.from({ length: dayCount + 1 }, (_, offset) => addDays(start, offset));
}

function dependencyConstrainedAllocationStart(
  input: AutoPlanningSolverInput,
  plans: AssignmentPlan[],
  solverAssignment: SolverAssignment
): PlanDate | null {
  const starts = input.snapshot.dependencies
    .filter((dependency) => dependency.successorTaskId === solverAssignment.assignment.taskId)
    .map((dependency) => dependencyStartFromSpan(input, plans, solverAssignment, dependency))
    .filter((date): date is PlanDate => Boolean(date));
  return latestPlanDate(starts);
}

function dependencyStartFromSpan(
  input: AutoPlanningSolverInput,
  plans: AssignmentPlan[],
  solverAssignment: SolverAssignment,
  dependency: PlanDependency
): PlanDate | null {
  const predecessor = taskSpanFromPlans(plans, dependency.predecessorTaskId) ??
    taskSpanFromCalculatedPlan(input, dependency.predecessorTaskId);
  if (!predecessor) return null;

  const lagDays = Math.floor(dependency.lagMinutes / 480);
  const successorSpanDays = Math.max(
    0,
    diffCalendarDays(
      solverAssignment.task.calculatedStart ?? input.snapshot.project.plannedStart,
      solverAssignment.task.calculatedFinish ?? solverAssignment.task.calculatedStart ?? input.snapshot.project.plannedStart
    )
  );

  if (dependency.type === "FS") return addDays(predecessor.finish, 1 + lagDays);
  if (dependency.type === "SS") return addDays(predecessor.start, lagDays);
  if (dependency.type === "FF") return addDays(predecessor.finish, lagDays - successorSpanDays);
  return addDays(predecessor.start, lagDays - successorSpanDays);
}

function taskSpanFromPlans(
  plans: AssignmentPlan[],
  taskId: string
): { start: PlanDate; finish: PlanDate } | null {
  const dates = plans
    .filter((plan) => plan.assignment.taskId === taskId)
    .flatMap((plan) => plan.allocations.map((allocation) => allocation.date));
  return dateSpan(dates);
}

function taskSpanFromCalculatedPlan(
  input: AutoPlanningSolverInput,
  taskId: string
): { start: PlanDate; finish: PlanDate } | null {
  const task = input.calculatedPlan.tasks.find((candidate) => candidate.id === taskId);
  if (!task?.calculatedStart || !task.calculatedFinish) return null;
  return { start: task.calculatedStart, finish: task.calculatedFinish };
}

function dateSpan(dates: PlanDate[]): { start: PlanDate; finish: PlanDate } | null {
  const sorted = [...dates].sort(comparePlanDates);
  const start = sorted[0];
  const finish = sorted.at(-1);
  return start && finish ? { start, finish } : null;
}

function resolveAssignmentWork(
  assignments: PlanAssignment[],
  assignment: PlanAssignment,
  taskWorkMinutes: number
): number {
  if (assignment.workMinutes !== null) return assignment.workMinutes;
  const taskAssignments = assignments.filter((candidate) => candidate.taskId === assignment.taskId && isWorkAssignment(candidate));
  const explicitWork = taskAssignments.reduce((total, candidate) => total + (candidate.workMinutes ?? 0), 0);
  const implicitAssignments = taskAssignments.filter((candidate) => candidate.workMinutes === null);
  const implicitUnits = implicitAssignments.reduce((total, candidate) => total + candidate.unitsPermille, 0);
  if (implicitUnits <= 0) return 0;
  return Math.round((Math.max(0, taskWorkMinutes - explicitWork) * assignment.unitsPermille) / implicitUnits);
}

function mergeAllocations(allocations: Array<{ date: PlanDate; workMinutes: number }>) {
  const byDate = new Map<PlanDate, number>();
  for (const allocation of allocations) {
    byDate.set(allocation.date, (byDate.get(allocation.date) ?? 0) + allocation.workMinutes);
  }
  return [...byDate.entries()]
    .map(([date, workMinutes]) => ({ date, workMinutes }))
    .filter((allocation) => allocation.workMinutes > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function isWorkAssignment(assignment: PlanAssignment): boolean {
  return assignment.role === "executor" || assignment.role === "co_executor";
}

function resourceDateKey(resourceId: string, date: PlanDate): string {
  return `${resourceId}\u0000${date}`;
}

function deadlineMissDays(deadline: PlanDate | null, finishDate: PlanDate | null): number {
  if (!deadline || !finishDate || comparePlanDates(finishDate, deadline) <= 0) return 0;
  return diffCalendarDays(deadline, finishDate);
}

function latestPlanDate(dates: Array<PlanDate | null | undefined>): PlanDate | null {
  return dates.reduce<PlanDate | null>((latest, date) => {
    if (!date) return latest;
    if (!latest) return date;
    return comparePlanDates(date, latest) > 0 ? date : latest;
  }, null);
}

function compareNullableDates(left: PlanDate | null, right: PlanDate | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return comparePlanDates(left, right);
}

function operationRisk(operationKinds: string[]): number {
  return operationKinds.reduce((total, kind) => {
    if (kind === "overload") return total + 100;
    if (kind === "split") return total + 20;
    if (kind === "single") return total + 5;
    return total + 10;
  }, 0);
}

function proposalCost(input: {
  deadlineDeltaDays: number;
  finishDate: PlanDate | null;
  projectStart: PlanDate;
  overloadMinutes: number;
  changedCount: number;
  riskScore: number;
}): number {
  const finishDistance = input.finishDate ? diffCalendarDays(input.projectStart, input.finishDate) : 100_000;
  return (
    input.deadlineDeltaDays * 1_000_000 +
    finishDistance * 10_000 +
    input.overloadMinutes * 100 +
    input.changedCount * 10 +
    input.riskScore
  );
}
